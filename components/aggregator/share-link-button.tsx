'use client'

import {useState} from 'react'

import {Button} from '@/components/ui/button'

type ShareLinkButtonProps = {
  className?: string
}

export function ShareLinkButton({className}: ShareLinkButtonProps) {
  const [copied, setCopied] = useState(false)

  async function copyLink() {
    const href = window.location.href

    try {
      await navigator.clipboard.writeText(href)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <Button type="button" variant="secondary" className={className} onClick={copyLink}>
      {copied ? 'Link copied' : 'Share link'}
    </Button>
  )
}
