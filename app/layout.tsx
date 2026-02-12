import type {Metadata} from 'next'
import {Newsreader, Public_Sans} from 'next/font/google'

import {ThemeToggle} from '@/components/theme-toggle'

import './globals.css'

const publicSans = Public_Sans({
  subsets: ['latin'],
  variable: '--font-public-sans',
  display: 'swap',
})

const newsreader = Newsreader({
  subsets: ['latin'],
  variable: '--font-newsreader',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Field Brief | Defense Signals by Interest',
  description:
    'A blended defense briefing surface with optional personalization by mission, domain, and technology interests.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${publicSans.variable} ${newsreader.variable} antialiased`}>
        <ThemeToggle />
        {children}
      </body>
    </html>
  )
}
