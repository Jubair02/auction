import type { Strings } from '@/lib/i18n'

/** Strings of the organizer controls card itself (buttons and its confirmations). */
export const CONTROLS_STRINGS = {
  en: {
    title: 'Organizer controls',
    startAuction: 'Start Auction',
    endedNote: 'Auction ended — head to the results report for final squads.',
    reopenAuction: 'Reopen auction',
    nextAutoTitle: 'Auto Auction brings up the next player — turn it off to pick manually',
    alreadyOnBlock: 'A player is already on the block',
    bringRandom: 'Bring a random player to the block',
    nextAutomatic: 'Next player (automatic)',
    nextRandom: 'Next player (random)',
    skip: 'Skip',
    resume: 'Resume',
    pause: 'Pause',
    sellNow: 'Sell now',
    unsold: 'Unsold',
    pickHint: 'Pick a player from the pool below or bring a random one.',
    manualBid: 'Manual bid',
    endAuction: 'End auction',
    sellTitle: 'Sell to highest bidder?',
    thePlayer: 'the player',
    sellDesc: (team: string, player: string, amount: string) =>
      `${team} wins ${player} for ${amount}. This cannot be undone here — use Re-auction later if needed.`,
    noBidToSell: 'No bid to sell.',
    unsoldTitle: 'Mark player UNSOLD?',
    thisPlayer: 'this player',
    unsoldDesc: (player: string) =>
      `The timer stops and ${player} goes unpicked. You can re-auction them from the pool later.`,
    markUnsold: 'Mark unsold',
    endTitle: 'End this auction?',
    endDesc:
      'Any player currently on the block returns to the pool, and the tournament is marked completed. Sold players keep their teams. You can reopen the auction afterwards if you need to.',
    roundTitle: (round: number) => `Start round ${round}?`,
    roundDesc: (leftOver: number, auto: boolean) =>
      `The ${leftOver} unsold & skipped player${leftOver === 1 ? '' : 's'} go back into the pool and are auctioned again from their base price. Sold players, squads, budgets and all earlier bids stay as they are.${auto ? ' Auto Auction is on, so the first player comes up by itself.' : ' Use Next player to bring up each player.'}`,
    startReauction: 'Start re-auction round',
    reopenTitle: 'Reopen the auction?',
    reopenDesc:
      'The room goes live again so you can auction the remaining players. Sold players, squads and budgets stay exactly as they are.',
    skipTitle: 'Skip this player?',
    skipDesc: (player: string, team: string, amount: string) =>
      `${player} has a live bid of ${amount} from ${team}. Skipping drops that bid and sets the player aside — you can re-auction them later.`,
    bidChanged: ' Heads up: the bid has changed since you opened this — cancel and check again.',
    playerChanged: 'The player on the block changed, so the confirmation was closed.',
  },
  bn: {
    title: 'আয়োজকের নিয়ন্ত্রণ',
    startAuction: 'নিলাম শুরু করুন',
    endedNote: 'নিলাম শেষ — চূড়ান্ত স্কোয়াড দেখতে ফলাফলের রিপোর্টে যান।',
    reopenAuction: 'নিলাম আবার খুলুন',
    nextAutoTitle: 'অটো নিলাম নিজেই পরের খেলোয়াড় আনছে — হাতে বাছাই করতে এটি বন্ধ করুন',
    alreadyOnBlock: 'একজন খেলোয়াড় এখন নিলামে আছে',
    bringRandom: 'র‍্যান্ডম একজন খেলোয়াড়কে নিলামে আনুন',
    nextAutomatic: 'পরের খেলোয়াড় (অটো)',
    nextRandom: 'পরের খেলোয়াড় (র‍্যান্ডম)',
    skip: 'বাদ দিন',
    resume: 'আবার শুরু',
    pause: 'বিরতি',
    sellNow: 'এখনই বিক্রি',
    unsold: 'অবিক্রিত',
    pickHint: 'নিচের পুল থেকে একজন খেলোয়াড় বেছে নিন, অথবা র‍্যান্ডম একজনকে আনুন।',
    manualBid: 'ম্যানুয়াল বিড',
    endAuction: 'নিলাম শেষ করুন',
    sellTitle: 'সর্বোচ্চ বিডারের কাছে বিক্রি করবেন?',
    thePlayer: 'খেলোয়াড়টি',
    sellDesc: (team: string, player: string, amount: string) =>
      `${team} ${amount}-এ ${player} পাচ্ছে। এখান থেকে এটি ফেরানো যাবে না — দরকার হলে পরে পুনরায় নিলাম করুন।`,
    noBidToSell: 'বিক্রি করার মতো কোনো বিড নেই।',
    unsoldTitle: 'খেলোয়াড়কে অবিক্রিত ঘোষণা করবেন?',
    thisPlayer: 'এই খেলোয়াড়',
    unsoldDesc: (player: string) =>
      `টাইমার থেমে যাবে এবং ${player} কোনো দলে যাবে না। পরে পুল থেকে আবার নিলামে তুলতে পারবেন।`,
    markUnsold: 'অবিক্রিত ঘোষণা',
    endTitle: 'এই নিলাম শেষ করবেন?',
    endDesc:
      'এখন নিলামে থাকা খেলোয়াড় পুলে ফিরে যাবে এবং টুর্নামেন্টটি সম্পন্ন হিসেবে চিহ্নিত হবে। বিক্রি হওয়া খেলোয়াড়রা নিজ নিজ দলেই থাকবে। দরকার হলে পরে নিলাম আবার খুলতে পারবেন।',
    roundTitle: (round: number) => `রাউন্ড ${round} শুরু করবেন?`,
    roundDesc: (leftOver: number, auto: boolean) =>
      `অবিক্রিত ও বাদ পড়া ${leftOver} জন খেলোয়াড় পুলে ফিরে যাবে এবং বেস প্রাইস থেকে আবার নিলাম হবে। বিক্রি হওয়া খেলোয়াড়, স্কোয়াড, বাজেট ও আগের সব বিড যেমন আছে তেমনই থাকবে।${auto ? ' অটো নিলাম চালু আছে, তাই প্রথম খেলোয়াড় নিজে থেকেই আসবে।' : ' প্রতিটি খেলোয়াড়কে আনতে “পরের খেলোয়াড়” চাপুন।'}`,
    startReauction: 'পুনরায় নিলামের রাউন্ড শুরু করুন',
    reopenTitle: 'নিলাম আবার খুলবেন?',
    reopenDesc:
      'রুমটি আবার লাইভ হবে, যাতে বাকি খেলোয়াড়দের নিলাম করতে পারেন। বিক্রি হওয়া খেলোয়াড়, স্কোয়াড ও বাজেট ঠিক যেমন আছে তেমনই থাকবে।',
    skipTitle: 'এই খেলোয়াড়কে বাদ দেবেন?',
    skipDesc: (player: string, team: string, amount: string) =>
      `${player}-এর জন্য ${team}-এর ${amount} বিড চলছে। বাদ দিলে বিডটি বাতিল হবে এবং খেলোয়াড়কে আলাদা রাখা হবে — পরে আবার নিলামে তুলতে পারবেন।`,
    bidChanged: ' খেয়াল করুন: এটি খোলার পর বিড বদলে গেছে — বাতিল করে আবার দেখে নিন।',
    playerChanged: 'নিলামের খেলোয়াড় বদলে গেছে, তাই নিশ্চিতকরণটি বন্ধ করা হয়েছে।',
  },
} satisfies Strings<{
  title: string
  startAuction: string
  endedNote: string
  reopenAuction: string
  nextAutoTitle: string
  alreadyOnBlock: string
  bringRandom: string
  nextAutomatic: string
  nextRandom: string
  skip: string
  resume: string
  pause: string
  sellNow: string
  unsold: string
  pickHint: string
  manualBid: string
  endAuction: string
  sellTitle: string
  thePlayer: string
  sellDesc: (team: string, player: string, amount: string) => string
  noBidToSell: string
  unsoldTitle: string
  thisPlayer: string
  unsoldDesc: (player: string) => string
  markUnsold: string
  endTitle: string
  endDesc: string
  roundTitle: (round: number) => string
  roundDesc: (leftOver: number, auto: boolean) => string
  startReauction: string
  reopenTitle: string
  reopenDesc: string
  skipTitle: string
  skipDesc: (player: string, team: string, amount: string) => string
  bidChanged: string
  playerChanged: string
}>
