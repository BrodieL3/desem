import Link from 'next/link'

import {SignInForm} from '@/components/auth/sign-in-form'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card'

function resolveNextPath(value: string | undefined) {
  if (!value || !value.startsWith('/')) {
    return '/'
  }

  return value
}

type SignInPageProps = {
  searchParams?: Promise<{next?: string; error?: string}>
}

export default async function SignInPage({searchParams}: SignInPageProps) {
  const params = searchParams ? await searchParams : undefined
  const nextPath = resolveNextPath(params?.next)
  const errorMessage = params?.error ?? null

  return (
    <main className="min-h-screen px-4 py-5 md:px-8 md:py-8">
      <div className="editorial-shell mx-auto flex min-h-[80svh] w-full max-w-lg items-center p-5 md:p-8">
        <Card className="w-full">
          <CardHeader className="space-y-2">
            <CardTitle className="font-display text-4xl leading-tight">Sign in</CardTitle>
            <CardDescription>
              Use a magic link to follow topics, comment on articles, and personalize your news feed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <SignInForm nextPath={nextPath} errorMessage={errorMessage} />

            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <Link href="/" className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline">
                Continue without signing in
              </Link>
              <span className="text-muted-foreground">Next: {nextPath}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
