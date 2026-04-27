import { Resend } from 'resend'
import type { ContactPayload } from '../data/types.js'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const directEmail = 'felixwang1222@gmail.com'

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

  const name = payload.name.trim()
  const email = payload.email.trim()
  const company = payload.company?.trim() || ''
  const message = payload.message.trim()

  if (!name) {
    fieldErrors.name = 'This field is required.'
  }
  if (!email) {
    fieldErrors.email = 'This field is required.'
  } else if (!emailPattern.test(email)) {
    fieldErrors.email = 'Enter a valid email address.'
  }
  if (!message) {
    fieldErrors.message = 'This field is required.'
  } else if (message.length < 10) {
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
  const fromEmail = dependencies.fromEmail ?? process.env.CONTACT_FROM_EMAIL
  const toEmail = dependencies.toEmail ?? process.env.CONTACT_TO_EMAIL ?? directEmail

  if (!apiKey || !fromEmail) {
    return {
      httpStatus: 500,
      body: {
        status: 'error',
        message: `Failed to send. Try emailing directly at ${directEmail}.`,
      },
    }
  }

  try {
    const createClient = dependencies.createClient ?? ((key: string) => new Resend(key))
    const client = createClient(apiKey)
    const safeName = escapeHtml(name)
    const safeEmail = escapeHtml(email)
    const safeCompany = escapeHtml(company || 'N/A')
    const safeMessage = escapeHtml(message).replace(/\n/g, '<br />')

    const sendResult = await client.emails.send({
      from: fromEmail,
      to: toEmail,
      replyTo: email,
      subject: `Portfolio inquiry from ${name}`,
      text: `Name: ${name}\nEmail: ${email}\nCompany: ${company || 'N/A'}\n\n${message}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
          <h2 style="margin: 0 0 16px;">Portfolio inquiry</h2>
          <p><strong>Name:</strong> ${safeName}</p>
          <p><strong>Email:</strong> ${safeEmail}</p>
          <p><strong>Company:</strong> ${safeCompany}</p>
          <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
          <p>${safeMessage}</p>
        </div>
      `,
    })

    if ('error' in sendResult && sendResult.error) {
      return {
        httpStatus: 502,
        body: {
          status: 'error',
          message: `Failed to send. Try emailing directly at ${directEmail}.`,
        },
      }
    }

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
        message: `Failed to send. Try emailing directly at ${directEmail}.`,
      },
    }
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
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
