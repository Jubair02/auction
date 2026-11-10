'use client'

import type { MouseEvent, ReactNode } from 'react'
import { ArrowUpRight, Gavel, MessageCircle, Phone } from 'lucide-react'
import { AppLink } from '@/components/shared/app-link'
import { DataSaverToggle } from '@/components/shared/data-saver'
import { DASHBOARD_PATH } from '@/lib/access'
import { type Strings, useStrings } from '@/lib/i18n'
import { navigate } from '@/lib/router'
import { useAuthState } from '@/lib/store'
import { cn } from '@/lib/utils'

const DEVELOPER_URL = 'https://jhossain.vercel.app'

const STRINGS = {
  en: {
    tagline: 'Live player auctions for Bangladesh',
    about: 'Run your tournament’s player auction live — teams bid from their phones, budgets are enforced and every sale is recorded.',
    facts: ['BDT pricing', 'Cricket & Football', 'Room-code joining'],
    product: 'Product',
    legal: 'Legal',
    support: 'Support',
    joinRoom: 'Join an auction room',
    createTournament: 'Create a tournament',
    myDashboard: 'My dashboard',
    pricing: 'Pricing',
    privacy: 'Privacy notice',
    terms: 'Terms of Service',
    refunds: 'Refund policy',
    call: (phone: string) => `Call ${phone}`,
    whatsapp: 'Message on WhatsApp',
    noSupport: 'Questions? Ask your tournament’s organizer.',
    rights: (year: number, name: string) => `© ${year} ${name}. All rights reserved.`,
    builtBy: 'Built by',
    newTab: '(opens in a new tab)',
  },
  bn: {
    tagline: 'বাংলাদেশের লাইভ প্লেয়ার নিলাম',
    about: 'আপনার টুর্নামেন্টের প্লেয়ার নিলাম চালান লাইভ — দলগুলো ফোন থেকেই বিড করে, বাজেট নিজে থেকেই মানা হয়, আর প্রতিটি বিক্রির হিসাব থাকে।',
    facts: ['টাকায় হিসাব', 'ক্রিকেট ও ফুটবল', 'রুম কোড দিয়ে যোগদান'],
    product: 'প্রোডাক্ট',
    legal: 'নীতিমালা',
    support: 'সহায়তা',
    joinRoom: 'নিলাম রুমে যোগ দিন',
    createTournament: 'টুর্নামেন্ট তৈরি করুন',
    myDashboard: 'আমার ড্যাশবোর্ড',
    pricing: 'দাম',
    privacy: 'গোপনীয়তা নীতি',
    terms: 'ব্যবহারের শর্তাবলি',
    refunds: 'রিফান্ড নীতি',
    call: (phone: string) => `কল করুন ${phone}`,
    whatsapp: 'WhatsApp-এ মেসেজ দিন',
    noSupport: 'প্রশ্ন থাকলে আপনার টুর্নামেন্টের আয়োজককে জিজ্ঞেস করুন।',
    rights: (year: number, name: string) => `© ${year} ${name}। সর্বস্বত্ব সংরক্ষিত।`,
    builtBy: 'তৈরি করেছেন',
    newTab: '(নতুন ট্যাবে খুলবে)',
  },
} satisfies Strings<{
  tagline: string
  about: string
  facts: string[]
  product: string
  legal: string
  support: string
  joinRoom: string
  createTournament: string
  myDashboard: string
  pricing: string
  privacy: string
  terms: string
  refunds: string
  call: (phone: string) => string
  whatsapp: string
  noSupport: string
  rights: (year: number, name: string) => string
  builtBy: string
  newTab: string
}>

/**
 * Opens `path` and scrolls to the section `id` on it. The client router only
 * scrolls to the top, and a section on the page already open needs no
 * navigation at all.
 */
function jumpTo(e: MouseEvent<HTMLAnchorElement>, path: string, id: string) {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  e.preventDefault()
  const scroll = () => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  if (window.location.pathname === path) {
    window.history.replaceState(window.history.state, '', `${path}#${id}`)
    scroll()
    return
  }
  navigate(`${path}#${id}`)
  // The page renders on the next frames (and may still be loading its code).
  let tries = 0
  const wait = () => {
    if (document.getElementById(id)) return scroll()
    if (++tries < 40) window.setTimeout(wait, 50)
  }
  window.requestAnimationFrame(wait)
}

/** A Bangladeshi mobile number (01XXXXXXXXX, optionally +880) as wa.me digits, else null. */
function whatsappNumber(phone: string): string | null {
  const digits = phone.replace(/\D/g, '')
  const local = digits.startsWith('880') ? digits.slice(2) : digits
  return /^01[3-9]\d{8}$/.test(local) ? `88${local}` : null
}

const linkClass =
  'group inline-flex min-h-8 items-center gap-1.5 rounded-sm text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'

function FooterLink({ href, children, onClick }: { href: string; children: ReactNode; onClick?: (e: MouseEvent<HTMLAnchorElement>) => void }) {
  return (
    <AppLink href={href} onClick={onClick} className={linkClass}>
      <span className="transition-transform duration-200 group-hover:translate-x-0.5">{children}</span>
    </AppLink>
  )
}

function Column({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <h2 className="text-xs font-bold uppercase tracking-widest text-foreground/80">{title}</h2>
      <ul className="mt-3 space-y-1">{children}</ul>
    </div>
  )
}

/** The site footer: brand, navigation, legal, support and the developer credit. */
export function SiteFooter({ hidden, settings }: { hidden?: boolean; settings: Record<string, string> }) {
  const t = useStrings(STRINGS)
  const { user } = useAuthState()
  const siteName = settings.siteName?.trim() || 'NeelamGhor'
  const phone = settings.supportPhone?.trim() || ''
  const wa = phone ? whatsappNumber(phone) : null

  return (
    <footer
      hidden={hidden}
      className="relative mt-auto border-t bg-gradient-to-b from-muted/20 to-muted/60 pb-[env(safe-area-inset-bottom)] print:hidden"
    >
      {/* A thin brand-coloured highlight along the top edge. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

      <div className="container mx-auto max-w-7xl px-4 pt-10 pb-8 sm:pt-12">
        <div className="grid grid-cols-2 gap-x-6 gap-y-9 sm:grid-cols-3 lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))] lg:gap-x-10">
          {/* Brand */}
          <div className="col-span-2 sm:col-span-3 lg:col-span-1">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm shadow-primary/20">
                <Gavel className="h-4.5 w-4.5" aria-hidden />
              </span>
              <span className="text-lg font-extrabold tracking-tight">
                {siteName === 'NeelamGhor' ? (
                  <>
                    Neelam<span className="text-primary">Ghor</span>
                  </>
                ) : (
                  siteName
                )}
              </span>
            </div>
            <p className="mt-3 text-sm font-semibold text-foreground">{t.tagline}</p>
            <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">{t.about}</p>
            <ul className="mt-4 flex flex-wrap gap-1.5" aria-label={t.tagline}>
              {t.facts.map((fact) => (
                <li key={fact} className="rounded-full border bg-background/60 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {fact}
                </li>
              ))}
            </ul>
          </div>

          <Column title={t.product}>
            <li>
              <FooterLink href="/join">{t.joinRoom}</FooterLink>
            </li>
            <li>
              {user ? (
                <FooterLink href={DASHBOARD_PATH}>{t.myDashboard}</FooterLink>
              ) : (
                <FooterLink href="/register">{t.createTournament}</FooterLink>
              )}
            </li>
            <li>
              <FooterLink href="/#pricing" onClick={(e) => jumpTo(e, '/', 'pricing')}>
                {t.pricing}
              </FooterLink>
            </li>
          </Column>

          <Column title={t.legal}>
            <li>
              <FooterLink href="/privacy">{t.privacy}</FooterLink>
            </li>
            <li>
              <FooterLink href="/terms">{t.terms}</FooterLink>
            </li>
            <li>
              <FooterLink href="/terms#refunds" onClick={(e) => jumpTo(e, '/terms', 'refunds')}>
                {t.refunds}
              </FooterLink>
            </li>
          </Column>

          <Column title={t.support} className="col-span-2 sm:col-span-1">
            {phone ? (
              <>
                <li>
                  {/* Admin → Settings → support phone */}
                  <a className={linkClass} href={`tel:${phone.replace(/[^\d+]/g, '')}`}>
                    <Phone className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                    <span className="transition-transform duration-200 group-hover:translate-x-0.5">{t.call(phone)}</span>
                  </a>
                </li>
                {wa ? (
                  <li>
                    <a className={linkClass} href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                      <span className="transition-transform duration-200 group-hover:translate-x-0.5">{t.whatsapp}</span>
                      <span className="sr-only"> {t.newTab}</span>
                    </a>
                  </li>
                ) : null}
              </>
            ) : (
              <li className="text-sm text-muted-foreground">{t.noSupport}</li>
            )}
            <li className="pt-1 text-sm">
              <DataSaverToggle />
            </li>
          </Column>
        </div>
      </div>

      <div className="border-t border-border/70">
        <div className="container mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-muted-foreground sm:flex-row">
          <p>{t.rights(new Date().getFullYear(), siteName)}</p>
          <p className="flex items-center gap-1">
            {t.builtBy}{' '}
            <a
              href={DEVELOPER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'group relative inline-flex items-center gap-0.5 rounded-sm font-semibold text-foreground transition-colors duration-200 hover:text-primary',
                'after:absolute after:-bottom-0.5 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-primary after:transition-transform after:duration-300 hover:after:scale-x-100',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
              )}
            >
              Jubair Hossain
              <ArrowUpRight
                className="h-3 w-3 opacity-60 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:opacity-100"
                aria-hidden
              />
              <span className="sr-only"> {t.newTab}</span>
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}
