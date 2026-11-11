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
  /** CSV import is a Pro feature. */
  csvProTitle: string
  csvProOwner: string
  csvProAskOwner: string
  proBadge: string
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
    csvProTitle: 'CSV import is not available on the Free plan',
    csvProOwner: 'Upgrade this tournament to Pro to import players from a CSV file. You can still add players one by one.',
    csvProAskOwner: 'Ask the tournament owner to upgrade it to Pro to import players from a CSV file. You can still add players one by one.',
    proBadge: 'Pro',
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
    csvProTitle: 'ফ্রি প্ল্যানে CSV ইমপোর্ট নেই',
    csvProOwner: 'CSV ফাইল থেকে খেলোয়াড় ইমপোর্ট করতে টুর্নামেন্টটি Pro-তে আপগ্রেড করুন। একজন একজন করে খেলোয়াড় যোগ করা এখনো যাবে।',
    csvProAskOwner: 'CSV ফাইল থেকে খেলোয়াড় ইমপোর্ট করতে টুর্নামেন্টের মালিককে Pro-তে আপগ্রেড করতে বলুন। একজন একজন করে খেলোয়াড় যোগ করা এখনো যাবে।',
    proBadge: 'Pro',
  },
} satisfies Strings<SharedPlayersStrings>
