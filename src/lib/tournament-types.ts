// Tournament types offered when creating or editing a tournament. A short,
// sport-neutral list that fits cricket, football and any "Others" sport.
//
// The English value is what gets stored (it also shows in exports and on other
// people's screens); tournamentTypeLabel() translates it for display.
import type { Lang } from '@/lib/lang-cookie'

export const TOURNAMENT_TYPES = [
  'Club / League',
  'Corporate',
  'University / College',
  'School',
  'Community / Friends',
  'Open Tournament',
] as const

const BN: Record<string, string> = {
  'Club / League': 'ক্লাব / লিগ',
  Corporate: 'কর্পোরেট',
  'University / College': 'বিশ্ববিদ্যালয় / কলেজ',
  School: 'স্কুল',
  'Community / Friends': 'কমিউনিটি / বন্ধুদের',
  'Open Tournament': 'ওপেন টুর্নামেন্ট',
  // Types offered before the list was simplified — still on older tournaments.
  'Corporate Cricket': 'কর্পোরেট ক্রিকেট',
  'University Tournament': 'বিশ্ববিদ্যালয় টুর্নামেন্ট',
  'Local Club Tournament': 'লোকাল ক্লাব টুর্নামেন্ট',
  'School Tournament': 'স্কুল টুর্নামেন্ট',
  'Friends/Community Tournament': 'বন্ধু/কমিউনিটি টুর্নামেন্ট',
  'Indoor Cricket': 'ইনডোর ক্রিকেট',
  '6-a-side / 7-a-side Football': '৬/৭ জনের ফুটবল',
}

/** The type as shown to the reader: translated when known, otherwise exactly as saved. */
export function tournamentTypeLabel(value: string | null | undefined, lang: Lang): string | null {
  if (!value) return null
  return lang === 'bn' ? (BN[value] ?? value) : value
}

/**
 * The choices for a select: the standard list, plus the tournament's current
 * value if it is an older type that is no longer offered (so editing never
 * silently drops it).
 */
export function tournamentTypeOptions(current?: string | null): string[] {
  const list: string[] = [...TOURNAMENT_TYPES]
  if (current && !list.includes(current)) list.push(current)
  return list
}
