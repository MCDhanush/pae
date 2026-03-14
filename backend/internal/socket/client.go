package socket

import (
	"encoding/json"
	"time"

	"github.com/gorilla/websocket"
	"go.uber.org/zap"
)

const (
	// writeWait is the time allowed to write a message to the peer.
	writeWait = 10 * time.Second

	// pongWait is the time allowed to read the next pong message from the peer.
	pongWait = 60 * time.Second

	// pingPeriod is how often pings are sent. Must be less than pongWait.
	pingPeriod = (pongWait * 9) / 10

	// maxMessageSize is the maximum allowed message size in bytes.
	maxMessageSize = 4096
)

// Client represents a single WebSocket connection.
type Client struct {
	Hub      *Hub
	Conn     *websocket.Conn
	Send     chan []byte
	PIN      string
	PlayerID string
	Role     string // "host" | "player"
	handler  *Handler
	logger   *zap.Logger
}

// NewClient creates a new Client.
func NewClient(hub *Hub, conn *websocket.Conn, pin, playerID, role string, handler *Handler, logger *zap.Logger) *Client {
	return &Client{
		Hub:      hub,
		Conn:     conn,
		Send:     make(chan []byte, 256),
		PIN:      pin,
		PlayerID: playerID,
		Role:     role,
		handler:  handler,
		logger:   logger,
	}
}

// ReadPump pumps messages from the WebSocket connection to the hub.
// It runs in its own goroutine.
func (c *Client) ReadPump() {
	defer func() {
		c.handler.OnClientDisconnect(c)
		c.Hub.Unregister(c)
		c.Conn.Close()
	}()

	c.Conn.SetReadLimit(maxMessageSize)
	_ = c.Conn.SetReadDeadline(time.Now().Add(pongWait))
	c.Conn.SetPongHandler(func(string) error {
		_ = c.Conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, rawMsg, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				c.logger.Warn("websocket read error", zap.Error(err))
			}
			break
		}

		var msg Message
		if err := json.Unmarshal(rawMsg, &msg); err != nil {
			c.logger.Warn("invalid websocket message", zap.Error(err))
			continue
		}

		c.handler.HandleMessage(c, &msg)
	}
}

// WritePump pumps messages from the hub to the WebSocket connection.
// It runs in its own goroutine.
func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			_ = c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// The hub closed the channel.
				_ = c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.Conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			_, _ = w.Write(message)

			// Flush any queued messages in the same write.
			n := len(c.Send)
			for i := 0; i < n; i++ {
				_, _ = w.Write([]byte("\n"))
				_, _ = w.Write(<-c.Send)
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			_ = c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// sendMessage serialises msg to JSON and queues it on the client's Send channel.
func (c *Client) sendMessage(event string, payload interface{}) {
	msg := Message{Event: event, Payload: payload}
	data, err := json.Marshal(msg)
	if err != nil {
		c.logger.Error("failed to marshal outgoing message", zap.Error(err))
		return
	}
	select {
	case c.Send <- data:
	default:
		c.logger.Warn("client send buffer full, dropping message", zap.String("event", event))
	}
}
