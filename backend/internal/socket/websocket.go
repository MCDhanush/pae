package socket

import (
	"net/http"
	"time"

	"github.com/gorilla/websocket"
	"go.uber.org/zap"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	// Allow all origins in development; restrict in production via config.
	CheckOrigin: func(r *http.Request) bool { return true },
}

// ServeWS upgrades an HTTP connection to a WebSocket and registers the client
// with the hub. Query params expected: pin, player_id (optional), role.
func ServeWS(hub *Hub, handler *Handler, logger *zap.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		pin := r.URL.Query().Get("pin")
		if pin == "" {
			http.Error(w, "pin query parameter is required", http.StatusBadRequest)
			return
		}

		playerID := r.URL.Query().Get("player_id")
		role := r.URL.Query().Get("role")
		if role == "" {
			role = "player"
		}

		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			logger.Error("websocket upgrade failed", zap.Error(err))
			return
		}

		client := NewClient(hub, conn, pin, playerID, role, handler, logger)
		hub.Register(client)

		// Small delay so the hub's register channel is processed before we
		// broadcast the join event (the room must exist first).
		go func() {
			time.Sleep(50 * time.Millisecond)
			handler.OnClientConnect(client)
		}()

		go client.WritePump()
		go client.ReadPump()
	}
}
