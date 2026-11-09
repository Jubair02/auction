import { type UserRole } from '@/lib/types'
import { type Strings } from '@/lib/i18n'

export type SharedStrings = {
  couldNotLoad: (what: string) => string
  all: string
  tryAnother: string
  cancel: string
  colStatus: string
  colActions: string
  role: Record<UserRole, string>
}

/** Strings more than one admin tab uses; each tab spreads them into its own table. */
export const SHARED_STRINGS = {
  en: {
    couldNotLoad: (what) => `Could not load ${what}`,
    all: 'All',
    tryAnother: 'Try another search or filter.',
    cancel: 'Cancel',
    colStatus: 'Status',
    colActions: 'Actions',
    role: { ADMIN: 'admin', ORGANIZER: 'organizer', MANAGER: 'manager' },
  },
  bn: {
    couldNotLoad: (what) => `${what} লোড করা যায়নি`,
    all: 'সব',
    tryAnother: 'অন্য কিছু লিখে বা অন্য ফিল্টার দিয়ে দেখুন।',
    cancel: 'বাতিল',
    colStatus: 'স্ট্যাটাস',
    colActions: 'অ্যাকশন',
    role: { ADMIN: 'অ্যাডমিন', ORGANIZER: 'আয়োজক', MANAGER: 'ম্যানেজার' },
  },
} satisfies Strings<SharedStrings>
