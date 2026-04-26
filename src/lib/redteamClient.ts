// Thin client for /api/redteam. Keeps the component code clean.

export interface ClientMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface RedteamSuccessResponse {
  status: 'ok'
  reply: string
  captured: boolean
  attemptsUsed: number
  attemptsRemaining: number
  windowResetAt: number
  globalRemaining: number
}

export interface RedteamErrorResponse {
  status: 'error'
  code: string
  message: string
  retryAfterSeconds?: number
  attemptsUsed?: number
  attemptsRemaining?: number
  windowResetAt?: number
  globalRemaining?: number
}

export type RedteamResponse = RedteamSuccessResponse | RedteamErrorResponse

export async function sendRedteamTurn(messages: ClientMessage[]): Promise<RedteamResponse> {
  try {
    const res = await fetch('/api/redteam', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages }),
    })
    const data = (await res.json().catch(() => null)) as RedteamResponse | null
    if (data && (data.status === 'ok' || data.status === 'error')) return data
    return { status: 'error', code: 'network', message: 'No response body.' }
  } catch (err) {
    return {
      status: 'error',
      code: 'network',
      message: err instanceof Error ? err.message : 'Network error.',
    }
  }
}
