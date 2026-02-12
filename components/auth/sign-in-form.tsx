'use client'

import {FormEvent, useState} from 'react'

import {Button} from '@/components/ui/button'
import {createSupabaseBrowserClient} from '@/lib/supabase/client'

type SignInFormProps = {
  nextPath: string
  errorMessage: string | null
}

export function SignInForm({nextPath, errorMessage}: SignInFormProps) {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!email.trim()) {
      setStatusMessage('Enter an email address to continue.')
      return
    }

    const supabase = createSupabaseBrowserClient()

    if (!supabase) {
      setStatusMessage('Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.')
      return
    }

    setIsSubmitting(true)
    setStatusMessage(null)

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin
    const callbackUrl = new URL('/auth/callback', siteUrl)
    callbackUrl.searchParams.set('next', nextPath)

    const {error} = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: callbackUrl.toString(),
      },
    })

    if (error) {
      setStatusMessage(error.message)
      setIsSubmitting(false)
      return
    }

    setStatusMessage('Magic link sent. Check your inbox to finish signing in.')
    setIsSubmitting(false)
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="text-sm font-medium" htmlFor="email">
          Email address
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-soft)]"
          placeholder="you@company.com"
          required
        />

        <Button type="submit" className="w-full rounded-full" disabled={isSubmitting}>
          {isSubmitting ? 'Sending link...' : 'Send magic link'}
        </Button>
      </form>

      {errorMessage ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{errorMessage}</p> : null}
      {statusMessage ? <p className="rounded-md bg-slate-100 p-3 text-sm text-slate-700">{statusMessage}</p> : null}
    </div>
  )
}
