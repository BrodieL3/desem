import type {Metadata} from 'next'
import {Newsreader, Public_Sans} from 'next/font/google'

import {SiteDrawer} from '@/components/site-drawer'
import {getUserSession} from '@/lib/user/session'

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
  title: 'Field Brief | Defense News Aggregator',
  description:
    'A defense-focused news aggregator with full-text article reading, topic follows, and article discussions.',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const session = await getUserSession()

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${publicSans.variable} ${newsreader.variable} antialiased`}>
        <SiteDrawer isAuthenticated={session.isAuthenticated} email={session.email} />
        {children}
      </body>
    </html>
  )
}
