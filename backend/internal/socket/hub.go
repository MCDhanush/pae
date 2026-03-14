package socket

import (
	"sync"
)

// Room represents an active game room identified by a PIN.
type Room struct {
	PIN       string
	Clients   map[*Client]bool
	Broadcast chan []byte
	mu        sync.RWMutex
}

// addClient registers a client in the room.
func (r *Room) addClient(c *Client) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.Clients[c] = true
}

// removeClient unregisters a client from the room.
func (r *Room) removeClient(c *Client) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.Clients, c)
}

// size returns the number of connected clients.
func (r *Room) size() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.Clients)
}

// Hub manages all active rooms and client lifecycle.
type Hub struct {
	rooms      map[string]*Room
	register   chan *Client
	unregister chan *Client
	mu         sync.RWMutex
}

// NewHub creates and returns a Hub ready to be started.
func NewHub() *Hub {
	return &Hub{
		rooms:      make(map[string]*Room),
		register:   make(chan *Client, 256),
		unregister: make(chan *Client, 256),
	}
}

// Run starts the hub's event loop. It must be called in a goroutine.
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			room := h.GetOrCreateRoom(client.PIN)
			room.addClient(client)

		case client := <-h.unregister:
			h.mu.RLock()
			room, exists := h.rooms[client.PIN]
			h.mu.RUnlock()

			if exists {
				room.removeClient(client)
				close(client.Send)

				// Clean up empty rooms.
				if room.size() == 0 {
					h.mu.Lock()
					delete(h.rooms, client.PIN)
					h.mu.Unlock()
				}
			}
		}
	}
}

// GetOrCreateRoom returns the room for pin, creating it if necessary.
func (h *Hub) GetOrCreateRoom(pin string) *Room {
	h.mu.Lock()
	defer h.mu.Unlock()

	if room, ok := h.rooms[pin]; ok {
		return room
	}

	room := &Room{
		PIN:       pin,
		Clients:   make(map[*Client]bool),
		Broadcast: make(chan []byte, 256),
	}
	h.rooms[pin] = room

	// Start the room broadcaster goroutine.
	go room.runBroadcaster()

	return room
}

// BroadcastToRoom sends a raw message to all clients in a room.
func (h *Hub) BroadcastToRoom(pin string, message []byte) {
	h.mu.RLock()
	room, exists := h.rooms[pin]
	h.mu.RUnlock()

	if !exists {
		return
	}

	room.Broadcast <- message
}

// Register queues a client for registration.
func (h *Hub) Register(c *Client) {
	h.register <- c
}

// Unregister queues a client for unregistration.
func (h *Hub) Unregister(c *Client) {
	h.unregister <- c
}

// runBroadcaster drains the Broadcast channel and forwards messages to all
// clients in the room.
func (r *Room) runBroadcaster() {
	for msg := range r.Broadcast {
		r.mu.RLock()
		for client := range r.Clients {
			select {
			case client.Send <- msg:
			default:
				// Client's send buffer is full; drop message to avoid blocking.
			}
		}
		r.mu.RUnlock()
	}
}
