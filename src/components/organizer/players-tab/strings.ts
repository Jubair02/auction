import type { Strings } from '@/lib/i18n'

/** Strings used by more than one piece of the Players tab. Spread into each piece's own table. */
export type SharedPlayersStrings = {
  cancel: string
  name: string
  phone: string
  role: string
  category: string
  catShort: (c: string) => string
  colRole: string
  colCat: string
  colBase: string
  importCsv: string
  addPlayer: string
  upgradeHint: string
  upgradeAskOwner: string
  upgrade: string
}

export const SHARED_STRINGS = {
  en: {
    cancel: 'Cancel',
    name: 'Name',
    phone: 'Phone',
    role: 'Role',
    category: 'Category',
    catShort: (c: string) => `Cat ${c}`,
    colRole: 'Role',
    colCat: 'Cat',
    colBase: 'Base',
    importCsv: 'Import CSV',
    addPlayer: 'Add player',
    upgradeHint: 'Upgrade this tournament to Pro for unlimited players.',
    upgradeAskOwner: 'Ask the tournament owner to upgrade it to Pro for unlimited players.',
    upgrade: 'Upgrade to Pro',
  },
  bn: {
    cancel: 'বাতিল',
    name: 'নাম',
    phone: 'ফোন',
    role: 'রোল',
    category: 'ক্যাটাগরি',
    catShort: (c: string) => `ক্যাট ${c}`,
    colRole: 'রোল',
    colCat: 'ক্যাট',
    colBase: 'বেস',
    importCsv: 'CSV ইমপোর্ট',
    addPlayer: 'খেলোয়াড় যোগ করুন',
    upgradeHint: 'সীমাহীন খেলোয়াড়ের জন্য টুর্নামেন্টটি Pro-তে আপগ্রেড করুন।',
    upgradeAskOwner: 'সীমাহীন খেলোয়াড়ের জন্য টুর্নামেন্টের মালিককে Pro-তে আপগ্রেড করতে বলুন।',
    upgrade: 'Pro-তে আপগ্রেড',
  },
} satisfies Strings<SharedPlayersStrings>
