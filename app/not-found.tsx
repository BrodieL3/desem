import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="editorial-shell mx-auto max-w-md space-y-6 text-center">
        <p className="text-muted-foreground text-xs tracking-[0.16em] uppercase">Field Brief</p>
        <h1 className="font-display text-6xl leading-none text-foreground">404</h1>
        <p className="text-muted-foreground text-base">
          This page doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Back to briefing
        </Link>
      </div>
    </main>
  )
}
