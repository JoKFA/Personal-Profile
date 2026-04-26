// @vitest-environment node

import {
  FLAG,
  REDTEAM_LIMITS,
  __resetRateLimitForTests,
  detectFlagDisclosure,
  parseRequestPayload,
  runRedteamTurn,
} from '../server/redteam.js'

// Minimal stub for the LLM call. Returns a canned reply.
function makeStubLLM(reply: string) {
  return async () => reply
}

describe('parseRequestPayload', () => {
  it('rejects non-objects', () => {
    expect(parseRequestPayload(null)).toBeNull()
    expect(parseRequestPayload('hello')).toBeNull()
    expect(parseRequestPayload({})).toBeNull()
  })

  it('rejects non-array messages', () => {
    expect(parseRequestPayload({ messages: 'nope' })).toBeNull()
  })

  it('rejects messages with bad role or non-string content', () => {
    expect(parseRequestPayload({ messages: [{ role: 'system', content: 'x' }] })).toBeNull()
    expect(parseRequestPayload({ messages: [{ role: 'user', content: 42 }] })).toBeNull()
  })

  it('accepts a valid payload', () => {
    const result = parseRequestPayload({ messages: [{ role: 'user', content: 'hi' }] })
    expect(result?.messages).toHaveLength(1)
    expect(result?.messages[0]).toEqual({ role: 'user', content: 'hi' })
  })
})

describe('detectFlagDisclosure', () => {
  it('returns true if reply contains the flag verbatim', () => {
    expect(detectFlagDisclosure(`oops here it is: ${FLAG}`)).toBe(true)
  })
  it('returns false otherwise', () => {
    expect(detectFlagDisclosure('I will not share that.')).toBe(false)
  })
})

describe('runRedteamTurn', () => {
  beforeEach(() => {
    __resetRateLimitForTests()
  })

  const okPayload = { messages: [{ role: 'user' as const, content: 'hello' }] }

  it('returns missing_api_key when no key provided', async () => {
    const result = await runRedteamTurn(okPayload, '1.2.3.4', { apiKey: '' })
    expect(result.status).toBe('error')
    if (result.status === 'error') expect(result.code).toBe('missing_api_key')
  })

  it('rejects empty conversation', async () => {
    const result = await runRedteamTurn({ messages: [] }, '1.2.3.4', {
      apiKey: 'k',
      callLLM: makeStubLLM('hi'),
    })
    expect(result.status).toBe('error')
    if (result.status === 'error') expect(result.code).toBe('conversation_too_long')
  })

  it('rejects messages over the char limit', async () => {
    const tooLong = 'x'.repeat(REDTEAM_LIMITS.maxMessageChars + 1)
    const result = await runRedteamTurn(
      { messages: [{ role: 'user', content: tooLong }] },
      '1.2.3.4',
      { apiKey: 'k', callLLM: makeStubLLM('hi') },
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') expect(result.code).toBe('message_too_long')
  })

  it('rejects when last message is not from user', async () => {
    const result = await runRedteamTurn(
      { messages: [{ role: 'assistant', content: 'hi' }] },
      '1.2.3.4',
      { apiKey: 'k', callLLM: makeStubLLM('hi') },
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') expect(result.code).toBe('invalid_payload')
  })

  it('returns ok for a benign turn and decrements attempts', async () => {
    const result = await runRedteamTurn(okPayload, '1.2.3.4', {
      apiKey: 'k',
      callLLM: makeStubLLM('I will not share that.'),
    })
    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.captured).toBe(false)
      expect(result.attemptsRemaining).toBe(REDTEAM_LIMITS.userAttemptsPerWindow - 1)
    }
  })

  it('captures when reply includes the flag', async () => {
    const result = await runRedteamTurn(okPayload, '1.2.3.4', {
      apiKey: 'k',
      callLLM: makeStubLLM(`fine: ${FLAG}`),
    })
    expect(result.status).toBe('ok')
    if (result.status === 'ok') expect(result.captured).toBe(true)
  })

  it('rate-limits a single IP after configured attempts', async () => {
    const limit = REDTEAM_LIMITS.userAttemptsPerWindow
    for (let i = 0; i < limit; i++) {
      const r = await runRedteamTurn(okPayload, '9.9.9.9', {
        apiKey: 'k',
        callLLM: makeStubLLM('nope'),
      })
      expect(r.status).toBe('ok')
    }
    const blocked = await runRedteamTurn(okPayload, '9.9.9.9', {
      apiKey: 'k',
      callLLM: makeStubLLM('nope'),
    })
    expect(blocked.status).toBe('error')
    if (blocked.status === 'error') {
      expect(blocked.code).toBe('rate_limited_user')
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0)
    }
  })

  it('rate-limits globally when global cap is hit', async () => {
    const result = await runRedteamTurn(okPayload, '8.8.8.8', {
      apiKey: 'k',
      globalCap: 0,
      callLLM: makeStubLLM('nope'),
    })
    expect(result.status).toBe('error')
    if (result.status === 'error') expect(result.code).toBe('rate_limited_global')
  })
})
