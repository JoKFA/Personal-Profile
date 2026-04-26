import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import type { ContactPayload } from '../data/types'

interface ContactResponse {
  status: 'success' | 'error'
  message: string
  fieldErrors?: Partial<Record<keyof ContactPayload, string>>
}

export function ContactForm() {
  const shouldReduceMotion = useReducedMotion()
  const [submitted, setSubmitted] = useState(false)
  const [serverError, setServerError] = useState('')
  const successRef = useRef<HTMLDivElement>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ContactPayload>({
    defaultValues: { name: '', email: '', message: '', company: '', honeypot: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setServerError('')
    const response = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })

    const result = (await response.json()) as ContactResponse

    if (!response.ok || result.status !== 'success') {
      if (result.fieldErrors) {
        Object.entries(result.fieldErrors).forEach(([field, message]) => {
          if (message) setError(field as keyof ContactPayload, { message })
        })
      }
      setServerError(result.message || '// submission failed — try felixwang1222@gmail.com')
      return
    }

    setSubmitted(true)
  })

  // Scroll the success message into view on mobile where the form may be below the fold
  useEffect(() => {
    if (submitted && successRef.current) {
      successRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [submitted])

  const fadeProps = shouldReduceMotion
    ? {}
    : {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.2 },
      }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {submitted ? (
        <motion.div key="success" ref={successRef} {...fadeProps}>
          <p className="form-success">// message received</p>
          <p className="form-success-email">felixwang1222@gmail.com</p>
        </motion.div>
      ) : (
        <motion.form key="form" className="contact-form" onSubmit={onSubmit} {...fadeProps}>
          <label className="field-block">
            <span className="field-label">// name</span>
            <input
              className={`field-input${errors.name ? ' field-error-state' : ''}`}
              {...register('name', { required: 'required' })}
              autoComplete="name"
            />
            {errors.name && <span className="field-error">{errors.name.message}</span>}
          </label>

          <label className="field-block">
            <span className="field-label">// email</span>
            <input
              type="email"
              className={`field-input${errors.email ? ' field-error-state' : ''}`}
              {...register('email', {
                required: 'required',
                pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'invalid email' },
              })}
              autoComplete="email"
            />
            {errors.email && <span className="field-error">{errors.email.message}</span>}
          </label>

          <label className="field-block">
            <span className="field-label">// company (optional)</span>
            <input className="field-input" {...register('company')} autoComplete="organization" />
          </label>

          <label className="field-block field-hidden" aria-hidden="true">
            <span className="field-label">website</span>
            <input className="field-input" tabIndex={-1} {...register('honeypot')} autoComplete="off" />
          </label>

          <label className="field-block">
            <span className="field-label">// message</span>
            <textarea
              className={`field-input field-textarea${errors.message ? ' field-error-state' : ''}`}
              {...register('message', {
                required: 'required',
                minLength: { value: 10, message: 'too short (10 chars min)' },
              })}
            />
            {errors.message && <span className="field-error">{errors.message.message}</span>}
          </label>

          {serverError && <p className="form-server-error">{serverError}</p>}

          <button className="ghost-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'sending...' : '// send message'}
          </button>
        </motion.form>
      )}
    </AnimatePresence>
  )
}
