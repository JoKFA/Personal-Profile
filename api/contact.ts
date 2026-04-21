import { parseContactRequestBody, submitContactForm } from '../src/server/contact'

export default async function handler(
  req: { method?: string; body?: unknown },
  res: { status: (code: number) => { json: (body: unknown) => void } },
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method not allowed.' })
  }

  const payload = parseContactRequestBody(req.body)
  if (!payload) {
    return res.status(400).json({ status: 'error', message: 'Invalid request payload.' })
  }

  const result = await submitContactForm(payload)
  return res.status(result.httpStatus).json(result.body)
}
