import type { Metadata } from 'next'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { Gavel } from 'lucide-react'
import { LANG_COOKIE, parseLang } from '@/lib/lang-cookie'

export const metadata: Metadata = { title: 'Page not found — NeelamGhor', robots: { index: false, follow: false } }

const STRINGS = {
  en: { title: 'Page not found', body: 'The page you are looking for does not exist.', home: 'Back to home' },
  bn: { title: 'পেজটি পাওয়া যায়নি', body: 'আপনি যে পেজটি খুঁজছেন সেটি নেই।', home: 'হোমে ফিরে যান' },
}

/**
 * A real 404 (status and page) for addresses the app has no page for — see
 * isKnownRoute in src/lib/routes.ts. Rendered inside the root layout, so the
 * visitor's theme and language apply.
 */
export default async function NotFound() {
  const t = STRINGS[parseLang((await cookies()).get(LANG_COOKIE)?.value)]
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground" aria-hidden>
          <Gavel className="h-6 w-6" />
        </span>
        <p className="text-sm font-bold tracking-widest text-muted-foreground">404</p>
        <h1 className="mt-1 text-xl font-bold">{t.title}</h1>
        <p className="mt-1 mb-6 text-sm text-muted-foreground">{t.body}</p>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {t.home}
        </Link>
      </div>
    </main>
  )
}
