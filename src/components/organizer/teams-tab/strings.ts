import type { Strings } from '@/lib/i18n'

/** Strings used by more than one piece of the Teams tab. */
export const SHARED_STRINGS = {
  en: {
    addTeam: 'Add team',
    cancel: 'Cancel',
  },
  bn: {
    addTeam: 'দল যোগ করুন',
    cancel: 'বাতিল',
  },
} satisfies Strings<{
  addTeam: string
  cancel: string
}>
