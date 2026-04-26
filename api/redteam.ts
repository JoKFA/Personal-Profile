import { parseRequestPayload, runRedteamTurn } from '../src/server/redteam.js'

interface VercelRequest {
  method?: string
  body?: unknown
  headers?: Record<string, string | string[] | undefined>
}

interface VercelResponse {
  setHeader: (key: string, value: string) => void
  status: (code: number) => { json: (body: unknown) => void }
}

function extractClientIp(headers: VercelRequest['headers']): string {
  const h = headers ?? {}
  const fwd = h['x-forwarded-for']
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0]!.trim()
  if (Array.isArray(fwd) && fwd.length > 0) return fwd[0]!.split(',')[0]!.trim()
  const real = h['x-real-ip']
  if (typeof real === 'string' && real.length > 0) return real
  return 'unknown'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', code: 'method_not_allowed', message: 'POST only.' })
  }

  const payload = parseRequestPayload(req.body)
  if (!payload) {
    return res
      .status(400)
      .json({ status: 'error', code: 'invalid_payload', message: 'Expected { messages: [{ role, content }] }.' })
  }

  const clientIp = extractClientIp(req.headers)
  const result = await runRedteamTurn(payload, clientIp)

  // Rate-limit responses include Retry-After for good-citizen client behavior.
  if (result.status === 'error') {
    if (result.code === 'rate_limited_user' || result.code === 'rate_limited_global') {
      if (result.retryAfterSeconds) {
        res.setHeader('Retry-After', String(result.retryAfterSeconds))
      }
      return res.status(429).json(result)
    }
    if (result.code === 'missing_api_key' || result.code === 'upstream_error') {
      return res.status(503).json(result)
    }
    return res.status(400).json(result)
  }

  return res.status(200).json(result)
}
