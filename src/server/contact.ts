import { Resend } from 'resend'
import type { ContactPayload } from '../data/types.js'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface ContactDependencies {
  apiKey?: string
  fromEmail?: string
  toEmail?: string
  createClient?: (apiKey: string) => Pick<Resend, 'emails'>
}

interface ContactResult {
  httpStatus: number
  body: {
    status: 'success' | 'error'
    message: string
    fieldErrors?: Partial<Record<keyof ContactPayload, string>>
  }
}

export async function submitContactForm(
  payload: ContactPayload,
  dependencies: ContactDependencies = {},
): Promise<ContactResult> {
  if (payload.honeypot) {
    return {
      httpStatus: 200,
      body: {
        status: 'success',
        message: 'ignored',
      },
    }
  }

  const fieldErrors: Partial<Record<keyof ContactPayload, string>> = {}

  if (!payload.name.trim()) {
    fieldErrors.name = 'This field is required.'
  }
  if (!payload.email.trim()) {
    fieldErrors.email = 'This field is required.'
  } else if (!emailPattern.test(payload.email)) {
    fieldErrors.email = 'Enter a valid email address.'
  }
  if (!payload.message.trim()) {
    fieldErrors.message = 'This field is required.'
  } else if (payload.message.trim().length < 10) {
    fieldErrors.message = 'Message must be at least 10 characters.'
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      httpStatus: 400,
      body: {
        status: 'error',
        message: 'Validation failed.',
        fieldErrors,
      },
    }
  }

  const apiKey = dependencies.apiKey ?? process.env.RESEND_API_KEY
  const fromEmail = dependencies.fromEmail ?? process.env.CONTACT_FROM_EMAIL ?? 'portfolio@updates.example.com'
  const toEmail = dependencies.toEmail ?? process.env.CONTACT_TO_EMAIL ?? 'felixwang1222@gmail.com'

  if (!apiKey) {
    return {
      httpStatus: 500,
      body: {
        status: 'error',
        message: 'Failed to send. Try emailing directly at felixwang1222@gmail.com.',
      },
    }
  }

  try {
    const createClient = dependencies.createClient ?? ((key: string) => new Resend(key))
    const client = createClient(apiKey)

    await client.emails.send({
      from: fromEmail,
      to: toEmail,
      replyTo: payload.email,
      subject: `Portfolio inquiry from ${payload.name}`,
      text: `Name: ${payload.name}\nEmail: ${payload.email}\nCompany: ${payload.company || 'N/A'}\n\n${payload.message}`,
    })

    return {
      httpStatus: 200,
      body: {
        status: 'success',
        message: "Message sent. I'll get back to you.",
      },
    }
  } catch {
    return {
      httpStatus: 500,
      body: {
        status: 'error',
        message: 'Failed to send. Try emailing directly at felixwang1222@gmail.com.',
      },
    }
  }
}

export function parseContactRequestBody(body: unknown): ContactPayload | null {
  if (typeof body === 'string') {
    try {
      return parseContactRequestBody(JSON.parse(body))
    } catch {
      return null
    }
  }

  if (!body || typeof body !== 'object') {
    return null
  }

  const candidate = body as Partial<ContactPayload>
  if (
    typeof candidate.name !== 'string' ||
    typeof candidate.email !== 'string' ||
    typeof candidate.message !== 'string'
  ) {
    return null
  }

  return {
    name: candidate.name,
    email: candidate.email,
    message: candidate.message,
    company: typeof candidate.company === 'string' ? candidate.company : '',
    honeypot: typeof candidate.honeypot === 'string' ? candidate.honeypot : '',
  }
}
