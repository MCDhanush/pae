/**
 * Native WebSocket wrapper for PAE backend (Gorilla WebSocket).
 * Protocol: every frame is a JSON object { event: string, payload: any }
 *
 * Replaces socket.io-client — the backend speaks raw WebSocket, not Socket.IO.
 */

type EventHandler = (payload: unknown) => void

class PAESocket {
  private ws: WebSocket | null = null
  private listeners: Map<string, Set<EventHandler>> = new Map()
  private pingTimer: ReturnType<typeof setInterval> | null = null
  public connected = false

  connect(url: string): void {
    this.close()
    this.ws = new WebSocket(url)

    this.ws.onopen = () => {
      this.connected = true
      this.emit('connect', {})
      // Keep-alive ping every 30 s (backend pong handler resets its read deadline)
      this.pingTimer = setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ event: 'ping', payload: {} }))
        }
      }, 30_000)
    }

    this.ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data as string) as { event: string; payload: unknown }
        if (msg.event) this.emit(msg.event, msg.payload)
      } catch {
        // ignore malformed frames
      }
    }

    this.ws.onclose = () => {
      this.connected = false
      this.clearPing()
      this.emit('disconnect', {})
    }

    this.ws.onerror = () => {
      this.emit('error', { message: 'WebSocket error' })
    }
  }

  private clearPing() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
    }
  }

  close(): void {
    this.clearPing()
    if (this.ws) {
      this.ws.onopen = null
      this.ws.onmessage = null
      this.ws.onclose = null
      this.ws.onerror = null
      this.ws.close()
      this.ws = null
    }
    this.connected = false
  }

  on(event: string, handler: EventHandler): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    this.listeners.get(event)!.add(handler)
  }

  off(event: string, handler?: EventHandler): void {
    if (!handler) this.listeners.delete(event)
    else this.listeners.get(event)?.delete(handler)
  }

  offAll(): void {
    this.listeners.clear()
  }

  private emit(event: string, payload: unknown): void {
    this.listeners.get(event)?.forEach((h) => h(payload))
  }

  send(event: string, payload: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ event, payload }))
    }
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

const paeSocket = new PAESocket()

/**
 * Build the WebSocket URL from the current page origin.
 * Vite proxy forwards /ws → ws://localhost:8080/ws
 */
function buildWsUrl(pin: string, role: 'host' | 'player', playerID?: string): string {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  const params = new URLSearchParams({ pin, role })
  if (playerID) params.set('player_id', playerID)
  return `${proto}://${location.host}/ws?${params.toString()}`
}

export function connectSocket(
  pin: string,
  role: 'host' | 'player',
  playerID?: string,
): PAESocket {
  paeSocket.connect(buildWsUrl(pin, role, playerID))
  return paeSocket
}

export function getSocket(): PAESocket {
  return paeSocket
}

export function disconnectSocket(): void {
  paeSocket.close()
}

export function removeAllListeners(): void {
  paeSocket.offAll()
}

// ─── Event constants (values MUST match backend socket/events.go) ─────────────

export const SOCKET_EVENTS = {
  // Server → Client
  PLAYER_JOINED:      'player_join',        // backend: EventPlayerJoin
  PLAYER_LEFT:        'player_leave',       // backend: EventPlayerLeave
  GAME_STARTED:       'game_start',         // backend: EventGameStart
  QUESTION_START:     'question_start',     // backend: EventQuestionStart
  QUESTION_END:       'question_end',       // backend: EventQuestionEnd
  TIMER_UPDATE:       'timer_update',       // backend: EventTimerUpdate
  LEADERBOARD_UPDATE: 'leaderboard_update', // backend: EventLeaderboard
  GAME_ENDED:         'game_end',           // backend: EventGameEnd
  ANSWER_RESULT:      'answer_result',      // backend: EventAnswerResult

  // Client → Server
  ANSWER_SUBMIT:  'answer_submit',  // backend: EventAnswerSubmit
  START_GAME:     'start_game',
  NEXT_QUESTION:  'next_question',
  END_GAME:       'end_game',
} as const

// ─── Payload types (mirror backend structs) ────────────────────────────────────

export interface PlayerJoinedPayload {
  id: string
  nickname: string
  score: number
  session_id: string
  joined_at: string
}

export interface QuestionStartPayload {
  question_index: number
  total_questions: number
  question: import('../types').Question
  time_limit: number
}

export interface QuestionEndPayload {
  correct_answer: string
}

export interface TimerUpdatePayload {
  remaining: number
}

export interface LeaderboardPayload {
  entries: import('../types').LeaderboardEntry[]
}

export interface AnswerResultPayload {
  is_correct: boolean
  points: number
  total_score: number
}

export interface GameEndPayload {
  pin: string
  final_leaderboard: import('../types').LeaderboardEntry[]
}

// ─── Typed emit helpers ────────────────────────────────────────────────────────

export function emitSubmitAnswer(payload: {
  question_id: string
  answer: string
  time_left: number
  total_time: number
  player_id: string
}): void {
  paeSocket.send(SOCKET_EVENTS.ANSWER_SUBMIT, payload)
}

export function emitStartGame(): void {
  paeSocket.send(SOCKET_EVENTS.START_GAME, {})
}

export function emitNextQuestion(): void {
  paeSocket.send(SOCKET_EVENTS.NEXT_QUESTION, {})
}

export function emitEndGame(): void {
  paeSocket.send(SOCKET_EVENTS.END_GAME, {})
}
