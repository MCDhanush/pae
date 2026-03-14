/**
 * MQTT client wrapper for PAE using HiveMQ as broker.
 *
 * Backend publishes events to topics; frontend subscribes here.
 * All messages use the same JSON envelope: { event: string, payload: any }
 *
 * Topics:
 *   pae/game/{pin}/broadcast          – game-wide events (question_start, timer, etc.)
 *   pae/game/{pin}/lobby              – lobby events (player_join, player_leave)
 *   pae/game/{pin}/player/{id}/result – per-player events (answer_result)
 */

import mqtt from 'mqtt'
import type { MqttClient } from 'mqtt'

type EventHandler = (payload: unknown) => void

// ─── MQTT_EVENTS constants (match backend events/events.go) ───────────────────

export const MQTT_EVENTS = {
  // Server → Client
  PLAYER_JOINED:      'player_join',
  PLAYER_LEFT:        'player_leave',
  GAME_STARTED:       'game_start',
  QUESTION_START:     'question_start',
  QUESTION_END:       'question_end',
  TIMER_UPDATE:       'timer_update',
  LEADERBOARD_UPDATE: 'leaderboard_update',
  GAME_ENDED:         'game_end',
  ANSWER_RESULT:      'answer_result',
} as const

// ─── Payload types (mirror backend events package) ────────────────────────────

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

// ─── PAEMQTTClient class ──────────────────────────────────────────────────────

class PAEMQTTClient {
  private client: MqttClient | null = null
  private listeners: Map<string, Set<EventHandler>> = new Map()
  public connected = false

  /**
   * Connect to HiveMQ and subscribe to the appropriate topics for pin/playerID.
   */
  connect(pin: string, playerID?: string): void {
    this.close()

    const brokerUrl = import.meta.env.VITE_HIVEMQ_WS_URL ?? 'wss://broker.hivemq.com:8884/mqtt'
    const clientId = `pae-${Math.random().toString(16).slice(2)}`

    this.client = mqtt.connect(brokerUrl, {
      clientId,
      clean: true,
      reconnectPeriod: 3000,
      connectTimeout: 10_000,
    })

    const topics = [
      `pae/game/${pin}/broadcast`,
      `pae/game/${pin}/lobby`,
    ]
    if (playerID) {
      topics.push(`pae/game/${pin}/player/${playerID}/result`)
    }

    this.client.on('connect', () => {
      this.connected = true
      this.client!.subscribe(topics, (err) => {
        if (err) console.error('[MQTT] subscribe error', err)
      })
      this.dispatch('connect', {})
    })

    this.client.on('message', (_topic, buffer) => {
      try {
        const msg = JSON.parse(buffer.toString()) as { event: string; payload: unknown }
        if (msg.event) this.dispatch(msg.event, msg.payload)
      } catch {
        // ignore malformed frames
      }
    })

    this.client.on('error', (err) => {
      console.error('[MQTT] error', err)
      this.dispatch('error', { message: String(err) })
    })

    this.client.on('close', () => {
      this.connected = false
      this.dispatch('disconnect', {})
    })

    this.client.on('reconnect', () => {
      console.log('[MQTT] reconnecting…')
    })
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

  close(): void {
    if (this.client) {
      this.client.end(true)
      this.client = null
    }
    this.connected = false
  }

  private dispatch(event: string, payload: unknown): void {
    this.listeners.get(event)?.forEach((h) => h(payload))
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

const paeMQTT = new PAEMQTTClient()

export function connectMQTT(pin: string, playerID?: string): PAEMQTTClient {
  paeMQTT.connect(pin, playerID)
  return paeMQTT
}

export function getMQTT(): PAEMQTTClient {
  return paeMQTT
}

export function disconnectMQTT(): void {
  paeMQTT.close()
}

export function removeAllMQTTListeners(): void {
  paeMQTT.offAll()
}
