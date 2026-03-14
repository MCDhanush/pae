package utils

import (
	"sync"
	"time"
)

// Timer is a server-side countdown that fires a tick callback every second and
// an end callback when the countdown reaches zero.
type Timer struct {
	seconds int
	onTick  func(remaining int)
	onEnd   func()
	stopCh  chan struct{}
	once    sync.Once
}

// NewTimer creates and immediately starts a countdown Timer.
//
//   - seconds   – how long to count down
//   - onTick    – called once per second with the remaining seconds
//   - onEnd     – called when the countdown reaches zero
func NewTimer(seconds int, onTick func(remaining int), onEnd func()) *Timer {
	t := &Timer{
		seconds: seconds,
		onTick:  onTick,
		onEnd:   onEnd,
		stopCh:  make(chan struct{}),
	}

	go t.run()
	return t
}

// Stop cancels the timer early. It is safe to call Stop multiple times.
func (t *Timer) Stop() {
	t.once.Do(func() {
		close(t.stopCh)
	})
}

// run is the goroutine that drives the countdown.
func (t *Timer) run() {
	remaining := t.seconds
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-t.stopCh:
			return
		case <-ticker.C:
			remaining--
			if t.onTick != nil {
				t.onTick(remaining)
			}
			if remaining <= 0 {
				if t.onEnd != nil {
					t.onEnd()
				}
				return
			}
		}
	}
}
