// Bangla for the API's most common user-facing error messages. The server
// answers in English (its messages are also logged and used by scripts); the
// browser swaps in Bangla when the UI is in Bangla (lib/api.ts). Anything not
// listed here is shown as the server sent it.
//
// Keep keys identical to the server strings (jsonError('…') in src/app/api).

const EXACT: Record<string, string> = {
  // Generic / auth
  'Invalid request body': 'অনুরোধটি সঠিক নয়। আবার চেষ্টা করুন।',
  'You must be logged in': 'এটি করতে লগইন করুন।',
  'You do not have permission for this action': 'এই কাজের অনুমতি আপনার নেই।',
  'Invalid email or password': 'ইমেইল বা পাসওয়ার্ড সঠিক নয়।',
  'An account with this email already exists': 'এই ইমেইল দিয়ে আগেই একটি অ্যাকাউন্ট খোলা হয়েছে।',
  'Please enter a valid email address': 'সঠিক ইমেইল ঠিকানা দিন।',
  'Enter the email address you registered with': 'যে ইমেইল দিয়ে রেজিস্টার করেছিলেন সেটি দিন।',
  'Your account has been blocked. Please contact support.': 'আপনার অ্যাকাউন্ট ব্লক করা হয়েছে। সহায়তার জন্য যোগাযোগ করুন।',
  'Name must be 2–80 characters': 'নাম ২ থেকে ৮০ অক্ষরের মধ্যে হতে হবে।',
  'Name must be 2–40 characters': 'নাম ২ থেকে ৪০ অক্ষরের মধ্যে হতে হবে।',
  'User not found': 'ব্যবহারকারী পাওয়া যায়নি।',
  'The site address (APP_URL) is not configured. Please contact support.': 'সাইটের ঠিকানা সেট করা নেই। সহায়তার জন্য যোগাযোগ করুন।',

  // Tournaments
  'Tournament not found': 'টুর্নামেন্টটি পাওয়া যায়নি।',
  'You do not have permission to view this tournament': 'এই টুর্নামেন্ট দেখার অনুমতি আপনার নেই।',
  'You do not have permission to view these results': 'এই ফলাফল দেখার অনুমতি আপনার নেই।',
  'You do not have permission to manage this tournament': 'এই টুর্নামেন্ট পরিচালনার অনুমতি আপনার নেই।',
  'You do not have permission to manage this team': 'এই দল পরিচালনার অনুমতি আপনার নেই।',
  'You do not have permission to manage this player': 'এই খেলোয়াড় পরিচালনার অনুমতি আপনার নেই।',
  'Tournament name must be 2–80 characters': 'টুর্নামেন্টের নাম ২ থেকে ৮০ অক্ষরের মধ্যে হতে হবে।',
  'No valid fields to update': 'হালনাগাদ করার মতো কিছু পাওয়া যায়নি।',
  'Could not update tournament': 'টুর্নামেন্ট হালনাগাদ করা যায়নি।',
  'Start date must be a valid date (ISO string)': 'সঠিক শুরুর তারিখ দিন।',
  'Sport cannot be changed once the tournament is live or completed': 'টুর্নামেন্ট লাইভ বা শেষ হওয়ার পর খেলা বদলানো যায় না।',
  'Base price must be a whole amount from ৳1 to ৳1,000,000,000': 'বেস প্রাইস ৳1 থেকে ৳1,000,000,000-এর মধ্যে পূর্ণ সংখ্যা হতে হবে।',
  'Budget must be a whole amount from ৳1 to ৳1,000,000,000': 'বাজেট ৳1 থেকে ৳1,000,000,000-এর মধ্যে পূর্ণ সংখ্যা হতে হবে।',
  'Playing on field cannot be more than players per team': 'মাঠে খেলোয়াড় সংখ্যা দলের মোট খেলোয়াড়ের চেয়ে বেশি হতে পারে না।',
  'Cannot delete a tournament while its auction is live or paused — end the auction first': 'নিলাম চলাকালীন বা বিরতিতে টুর্নামেন্ট মোছা যায় না — আগে নিলাম শেষ করুন।',
  'Only the tournament owner can delete this tournament': 'শুধু টুর্নামেন্টের মালিক এটি মুছতে পারেন।',

  // Plans
  'SMS notifications are a Pro feature — upgrade this tournament to turn them on': 'SMS নোটিফিকেশন প্রো ফিচার — চালু করতে এই টুর্নামেন্ট প্রো-তে আপগ্রেড করুন।',
  'SMS notifications are a Pro feature — upgrade this tournament to send reminders.': 'SMS নোটিফিকেশন প্রো ফিচার — রিমাইন্ডার পাঠাতে এই টুর্নামেন্ট প্রো-তে আপগ্রেড করুন।',
  'This tournament is already on Pro': 'এই টুর্নামেন্ট আগেই প্রো-তে আছে।',
  'Pro payments are not set up yet. Please contact support.': 'প্রো পেমেন্ট এখনো চালু হয়নি। সহায়তার জন্য যোগাযোগ করুন।',
  'Turn on SMS notifications for this tournament first.': 'আগে এই টুর্নামেন্টের SMS নোটিফিকেশন চালু করুন।',

  // Teams
  'Team not found': 'দলটি পাওয়া যায়নি।',
  'Team not found in this tournament': 'এই টুর্নামেন্টে দলটি পাওয়া যায়নি।',
  'Team name must be 2–60 characters': 'দলের নাম ২ থেকে ৬০ অক্ষরের মধ্যে হতে হবে।',
  'Teams cannot be deleted while the auction is live or paused': 'নিলাম চলাকালীন বা বিরতিতে দল মোছা যায় না।',
  'Cannot delete a team that has bought players': 'যে দল খেলোয়াড় কিনেছে সেটি মোছা যায় না।',
  'Cannot delete a team that has placed bids — its bid history is part of the auction record': 'যে দল বিড করেছে সেটি মোছা যায় না — বিডের ইতিহাস নিলামের রেকর্ডের অংশ।',
  'Budget cannot be lower than the amount already spent on players': 'বাজেট খেলোয়াড় কেনায় খরচ হওয়া টাকার চেয়ে কম হতে পারে না।',
  'minSquad cannot be greater than maxSquad': 'ন্যূনতম স্কোয়াড সর্বোচ্চ স্কোয়াডের চেয়ে বেশি হতে পারে না।',
  'Cannot add more than 50 teams at once': 'একবারে ৫০টির বেশি দল যোগ করা যায় না।',
  'That manager already runs another team in this tournament.': 'ওই ম্যানেজার এই টুর্নামেন্টে আগেই আরেকটি দল চালাচ্ছেন।',
  'That manager account is blocked': 'ওই ম্যানেজার অ্যাকাউন্টটি ব্লক করা।',
  'No active team manager account uses that email. Ask them to register as a Team Manager first.': 'এই ইমেইলে কোনো সক্রিয় টিম ম্যানেজার অ্যাকাউন্ট নেই। আগে তাঁকে টিম ম্যানেজার হিসেবে রেজিস্টার করতে বলুন।',
  'Only accounts registered as a team manager can be linked to a team': 'শুধু টিম ম্যানেজার অ্যাকাউন্টকেই দলের সাথে যুক্ত করা যায়।',

  // Players
  'Player not found': 'খেলোয়াড় পাওয়া যায়নি।',
  'Player is on the block right now': 'খেলোয়াড়টি এখন নিলামে আছেন।',
  'Cannot delete a player who has been sold': 'বিক্রি হওয়া খেলোয়াড় মোছা যায় না।',
  'Base price and category cannot be changed after a player is sold': 'বিক্রির পর বেস প্রাইস ও ক্যাটাগরি বদলানো যায় না।',
  'Cannot add more than 500 players at once': 'একবারে ৫০০ জনের বেশি খেলোয়াড় যোগ করা যায় না।',
  'Category must be one of A, B, C, D, E': 'ক্যাটাগরি A, B, C, D বা E হতে হবে।',
  'Role is required': 'রোল দিতে হবে।',

  // Auction / room
  'Room not found. Check the code and try again.': 'রুম পাওয়া যায়নি। কোডটি দেখে আবার চেষ্টা করুন।',
  'Room not found': 'রুম পাওয়া যায়নি।',
  'This auction has already ended.': 'এই নিলাম শেষ হয়ে গেছে।',
  'An auction has already been created for this tournament': 'এই টুর্নামেন্টের নিলাম আগেই তৈরি হয়েছে।',
  'No auction has been created for this tournament yet': 'এই টুর্নামেন্টের নিলাম এখনো তৈরি হয়নি।',
  'Could not create the auction': 'নিলাম তৈরি করা যায়নি।',
  'Could not generate a unique room code, please try again': 'রুম কোড তৈরি করা যায়নি, আবার চেষ্টা করুন।',
  'Only the tournament organizer or its staff can join as organizer': 'শুধু টুর্নামেন্টের আয়োজক বা তাঁর স্টাফ আয়োজক হিসেবে যোগ দিতে পারেন।',
  'Only team manager accounts can take a bidding seat. Join as a viewer instead.': 'শুধু টিম ম্যানেজার অ্যাকাউন্ট বিড করতে পারে। দর্শক হিসেবে যোগ দিন।',
  'Log in with your team manager account to bid for a team.': 'দলের হয়ে বিড করতে টিম ম্যানেজার অ্যাকাউন্টে লগইন করুন।',
  'This team is registered to another manager. Please log in with that account.': 'এই দল অন্য একজন ম্যানেজারের নামে। সেই অ্যাকাউন্টে লগইন করুন।',
  'You already manage a team in this tournament — a manager can run only one team.': 'আপনি আগেই এই টুর্নামেন্টে একটি দল চালাচ্ছেন — একজন ম্যানেজার একটিই দল চালাতে পারেন।',
  'Select the team you manage': 'আপনি যে দল চালান সেটি বেছে নিন।',
  'Create the auction room first — the reminder links to it.': 'আগে নিলাম রুম তৈরি করুন — রিমাইন্ডারে এর লিংক যায়।',
  'Nobody to remind — no team manager or player has a valid mobile number.': 'রিমাইন্ডার পাঠানোর কেউ নেই — কোনো ম্যানেজার বা খেলোয়াড়ের সঠিক মোবাইল নম্বর নেই।',

  // Invites / staff
  'Log in with your team manager account to accept this invite.': 'আমন্ত্রণ গ্রহণ করতে টিম ম্যানেজার অ্যাকাউন্টে লগইন করুন।',
  'Invites are for team manager accounts. Log out and use (or create) a manager account.': 'আমন্ত্রণ শুধু টিম ম্যানেজার অ্যাকাউন্টের জন্য। লগ আউট করে ম্যানেজার অ্যাকাউন্ট ব্যবহার করুন (বা খুলুন)।',
  'No NeelamGhor account uses this email. Ask them to create an organizer account first.': 'এই ইমেইলে কোনো NeelamGhor অ্যাকাউন্ট নেই। আগে তাঁকে আয়োজক অ্যাকাউন্ট খুলতে বলুন।',
  'This person is already on the staff of this tournament': 'এই ব্যক্তি আগেই এই টুর্নামেন্টের স্টাফ।',
  'This person is not on the staff of this tournament': 'এই ব্যক্তি এই টুর্নামেন্টের স্টাফ নন।',
  'The tournament owner already has full access': 'টুর্নামেন্টের মালিকের আগেই সম্পূর্ণ অনুমতি আছে।',
  'Only the tournament owner can remove staff': 'শুধু টুর্নামেন্টের মালিক স্টাফ সরাতে পারেন।',
  'This account is blocked and cannot be added': 'এই অ্যাকাউন্টটি ব্লক করা, যোগ করা যাবে না।',

  // Player registration / payments
  'Registration for this tournament is closed.': 'এই টুর্নামেন্টের রেজিস্ট্রেশন বন্ধ।',
  'Registration is full right now. Please contact the organizer.': 'রেজিস্ট্রেশন এখন পূর্ণ। আয়োজকের সাথে যোগাযোগ করুন।',
  'This phone number is already registered for this tournament.': 'এই মোবাইল নম্বর দিয়ে এই টুর্নামেন্টে আগেই রেজিস্ট্রেশন হয়েছে।',
  'Enter a valid Bangladeshi mobile number, e.g. 01712345678': 'সঠিক বাংলাদেশি মোবাইল নম্বর দিন, যেমন 01712345678',
  'Enter the mobile number you paid from, e.g. 01712345678': 'যে নম্বর থেকে টাকা পাঠিয়েছেন সেটি দিন, যেমন 01712345678',
  'Enter the Transaction ID from your payment message (6–20 letters and numbers)': 'পেমেন্ট মেসেজের ট্রানজেকশন আইডি দিন (৬–২০টি অক্ষর ও সংখ্যা)',
  'This Transaction ID was already used for a registration. Check the ID in your payment message.': 'এই ট্রানজেকশন আইডি আগেই একটি রেজিস্ট্রেশনে ব্যবহার হয়েছে। পেমেন্ট মেসেজে আইডিটি দেখুন।',
  'This Transaction ID was already submitted': 'এই ট্রানজেকশন আইডি আগেই জমা দেওয়া হয়েছে।',
  'Choose how you paid the registration fee': 'রেজিস্ট্রেশন ফি কীভাবে দিয়েছেন তা বেছে নিন।',
  'Choose bKash or Nagad': 'বিকাশ বা নগদ বেছে নিন।',
  'Select at least one registration': 'অন্তত একটি রেজিস্ট্রেশন বেছে নিন।',
  'Those registrations were already handled': 'এই রেজিস্ট্রেশনগুলো আগেই দেখা হয়েছে।',
  'This payment was already reviewed': 'এই পেমেন্ট আগেই যাচাই করা হয়েছে।',
  'Payment not found': 'পেমেন্ট পাওয়া যায়নি।',

  // Uploads
  'Uploads need an organizer login or an open registration link': 'ছবি আপলোড করতে আয়োজক হিসেবে লগইন করুন বা খোলা রেজিস্ট্রেশন লিংক ব্যবহার করুন।',
  'Log in as an organizer to upload logos and banners': 'লোগো ও ব্যানার আপলোড করতে আয়োজক হিসেবে লগইন করুন।',
  'The file is empty': 'ফাইলটি খালি।',
  'That file is not a supported image (use JPG, PNG, WebP or GIF)': 'এই ফাইলটি সমর্থিত ছবি নয় (JPG, PNG, WebP বা GIF ব্যবহার করুন)।',

  // League, branding & sponsors, staff, payments, account (Phase 2–3)
  'A group match needs a group name, e.g. A': 'গ্রুপের ম্যাচে গ্রুপের নাম দিন, যেমন A।',
  'A knockout match needs a winner — pick who went through (e.g. on penalties or a super over)': 'নকআউট ম্যাচে একজন বিজয়ী লাগবে — কে পরের রাউন্ডে গেল তা বেছে নিন (যেমন পেনাল্টি বা সুপার ওভারে)।',
  'A team cannot play itself': 'একটি দল নিজের বিপক্ষে খেলতে পারে না।',
  'Add at least 2 teams before making fixtures': 'ফিকশ্চার বানানোর আগে অন্তত ২টি দল যোগ করুন।',
  'Another match was added at the same moment. Please try again.': 'একই সময়ে আরেকটি ম্যাচ যোগ হয়েছে। আবার চেষ্টা করুন।',
  'Both teams must be set before entering a result': 'ফলাফল দেওয়ার আগে দুই দলই ঠিক করুন।',
  'Both teams must be set before entering player stats': 'খেলোয়াড়দের পরিসংখ্যান দেওয়ার আগে দুই দলই ঠিক করুন।',
  'Could not add the match. Please try again.': 'ম্যাচ যোগ করা যায়নি। আবার চেষ্টা করুন।',
  'Days between rounds must be from 0 to 60': 'রাউন্ডের মাঝে ০ থেকে ৬০ দিন রাখা যায়।',
  'Each player can have only one stat line': 'প্রতিটি খেলোয়াড়ের একটিই পরিসংখ্যান সারি থাকতে পারে।',
  'Enter both scores, or pick another result type': 'দুই দলের স্কোর দিন, অথবা অন্য ধরনের ফলাফল বেছে নিন।',
  'Fixtures were being changed at the same moment. Please try again.': 'একই সময়ে ফিকশ্চার বদলানো হচ্ছিল। আবার চেষ্টা করুন।',
  'Group names must be 1–20 letters or numbers, e.g. A or B': 'গ্রুপের নাম ১–২০টি অক্ষর বা সংখ্যা হতে হবে, যেমন A বা B।',
  'League not found': 'লিগ পাওয়া যায়নি।',
  'Match date must be a valid date': 'ম্যাচের সঠিক তারিখ দিন।',
  'Match not found': 'ম্যাচটি পাওয়া যায়নি।',
  'Matches per day must be from 1 to 20': 'দিনে ১ থেকে ২০টি ম্যাচ রাখা যায়।',
  'Number of groups must be from 1 to 16': 'গ্রুপ ১ থেকে ১৬টি হতে পারে।',
  'Overs must look like 19.4 (balls after the dot: 0–5)': 'ওভার এভাবে লিখুন: 19.4 (দশমিকের পরে বল: ০–৫)।',
  'Overs per innings must be from 1 to 50': 'ইনিংসে ১ থেকে ৫০ ওভার রাখা যায়।',
  'Pick the team that won by walkover': 'ওয়াকওভারে কোন দল জিতেছে তা বেছে নিন।',
  'Placeholder must be at most 40 characters': 'প্লেসহোল্ডার সর্বোচ্চ ৪০ অক্ষরের হতে পারে।',
  'Player of the match must be in one of the two squads': 'ম্যাচসেরা খেলোয়াড়কে দুই দলের যেকোনো একটির হতে হবে।',
  'Points must be a whole number from 0 to 10': 'পয়েন্ট ০ থেকে ১০-এর মধ্যে পূর্ণ সংখ্যা হতে হবে।',
  'Result note must be at most 160 characters': 'ফলাফলের নোট সর্বোচ্চ ১৬০ অক্ষরের হতে পারে।',
  'Round must be from 1 to 200': 'রাউন্ড ১ থেকে ২০০-এর মধ্যে হতে হবে।',
  'Some matches already have results. Confirm replacing to delete every match and its stats.': 'কিছু ম্যাচের ফলাফল আগেই দেওয়া আছে। সব ম্যাচ ও পরিসংখ্যান মুছে নতুন করে বানাতে নিশ্চিত করুন।',
  'Stats can only be entered for players in the two squads': 'শুধু দুই দলের খেলোয়াড়দের পরিসংখ্যান দেওয়া যায়।',
  'Teams qualifying per group must be from 1 to 8': 'প্রতি গ্রুপ থেকে ১ থেকে ৮টি দল পরের পর্বে যেতে পারে।',
  'The winner must be one of the two teams': 'বিজয়ী দুই দলের একটি হতে হবে।',
  'The winner must be the team with the higher score': 'বেশি স্কোর করা দলই বিজয়ী হবে।',
  'Venue must be at most 80 characters': 'ভেন্যুর নাম সর্বোচ্চ ৮০ অক্ষরের হতে পারে।',
  'Auction mode cannot be changed once the tournament is live or completed': 'টুর্নামেন্ট লাইভ বা শেষ হওয়ার পর নিলামের ধরন বদলানো যায় না।',
  'Add a bKash or Nagad number so players know where to pay the registration fee': 'খেলোয়াড়রা কোথায় নিবন্ধন ফি পাঠাবে তা জানাতে একটি bKash বা Nagad নম্বর দিন।',
  'Registration fee must be a whole amount from ৳1 to ৳100,000': 'নিবন্ধন ফি ৳1 থেকে ৳100,000-এর মধ্যে পূর্ণ সংখ্যা হতে হবে।',
  'Brand colour must be a hex colour like #0F766E': 'ব্র্যান্ডের রং হেক্স কোডে দিন, যেমন #0F766E।',
  'Custom branding is a Pro feature — upgrade this tournament to use it': 'নিজস্ব ব্র্যান্ডিং প্রো ফিচার — ব্যবহার করতে এই টুর্নামেন্ট আপগ্রেড করুন।',
  'Sponsor not found': 'স্পনসর পাওয়া যায়নি।',
  'The sponsor list changed — reload and try again': 'স্পনসরের তালিকা বদলে গেছে — পেজ রিলোড করে আবার চেষ্টা করুন।',
  'A payment for this tournament is already waiting for review': 'এই টুর্নামেন্টের একটি পেমেন্ট ইতিমধ্যে যাচাইয়ের অপেক্ষায় আছে।',
  'Account not found': 'অ্যাকাউন্ট পাওয়া যায়নি।',
  'Admin accounts cannot be deleted here. Ask another admin to remove your admin role first.': 'অ্যাডমিন অ্যাকাউন্ট এখান থেকে মোছা যায় না। আগে আরেকজন অ্যাডমিনকে আপনার অ্যাডমিন ভূমিকা সরাতে বলুন।',
  'Enter your password to confirm': 'নিশ্চিত করতে আপনার পাসওয়ার্ড দিন।',
  'Incorrect password': 'পাসওয়ার্ড সঠিক নয়।',
}

/** Messages with numbers or names in them: [pattern, Bangla builder]. */
const PATTERNS: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^The free plan allows up to (\d+) teams\./, (m) => `ফ্রি প্ল্যানে সর্বোচ্চ ${m[1]}টি দল রাখা যায়। সীমাহীন দলের জন্য এই টুর্নামেন্ট প্রো-তে আপগ্রেড করুন।`],
  [/^The free plan allows up to (\d+) players\./, (m) => `ফ্রি প্ল্যানে সর্বোচ্চ ${m[1]} জন খেলোয়াড় রাখা যায়। সীমাহীন খেলোয়াড়ের জন্য এই টুর্নামেন্ট প্রো-তে আপগ্রেড করুন।`],
  [/^Too many [^.]*\. Please try again in (\d+) seconds\.$/, (m) => `অনেকবার চেষ্টা করা হয়েছে। ${m[1]} সেকেন্ড পরে আবার চেষ্টা করুন।`],
  [/^This tournament is getting a lot of sign-ups right now\. Please try again in (\d+) seconds\.$/, (m) => `এই টুর্নামেন্টে এখন অনেক রেজিস্ট্রেশন হচ্ছে। ${m[1]} সেকেন্ড পরে আবার চেষ্টা করুন।`],
  [/^A reminder was sent recently\. You can send another in (\d+) min\.$/, (m) => `কিছুক্ষণ আগেই রিমাইন্ডার পাঠানো হয়েছে। ${m[1]} মিনিট পরে আবার পাঠাতে পারবেন।`],
  [/^CSV cannot contain more than (\d+) data rows$/, (m) => `CSV-তে ${m[1]}টির বেশি সারি থাকতে পারবে না।`],
  [/^maxSquad cannot be lower than the (\d+) player\(s\) already bought$/, (m) => `সর্বোচ্চ স্কোয়াড ইতিমধ্যে কেনা ${m[1]} জন খেলোয়াড়ের কম হতে পারে না।`],
  [/^Team (\d+): name must be 2–60 characters$/, (m) => `দল ${m[1]}: নাম ২ থেকে ৬০ অক্ষরের মধ্যে হতে হবে।`],
  [/^Team (\d+): budget must be a whole amount/, (m) => `দল ${m[1]}: বাজেট ৳1 থেকে ৳1,000,000,000-এর মধ্যে পূর্ণ সংখ্যা হতে হবে।`],
  [/^(.+) already manages "(.+)"/, (m) => `${m[1]} আগেই এই টুর্নামেন্টে "${m[2]}" দলটি চালাচ্ছেন।`],
  [/^You already manage "(.+)"/, (m) => `আপনি আগেই এই টুর্নামেন্টে "${m[1]}" দলটি চালাচ্ছেন।`],
  [/^Request failed \((\d+)\)$/, (m) => `অনুরোধ সফল হয়নি (${m[1]})।`],
  [/^Download failed \((\d+)\)$/, (m) => `ডাউনলোড হয়নি (${m[1]})।`],
  [/^A tournament can have at most (\d+) matches$/, (m) => `একটি টুর্নামেন্টে সর্বোচ্চ ${m[1]}টি ম্যাচ রাখা যায়।`],
  [/^A tournament can have at most (\d+) sponsors$/, (m) => `একটি টুর্নামেন্টে সর্বোচ্চ ${m[1]}টি স্পনসর রাখা যায়।`],
  [/^Scores must be whole numbers from 0 to (\d+)$/, (m) => `স্কোর ০ থেকে ${m[1]}-এর মধ্যে পূর্ণ সংখ্যা হতে হবে।`],
  [/^Wickets must be from 0 to (\d+)$/, (m) => `উইকেট ০ থেকে ${m[1]}-এর মধ্যে হতে হবে।`],
  [/^Sponsors are a Pro feature/, () => `স্পনসর প্রো ফিচার — যোগ করতে এই টুর্নামেন্ট আপগ্রেড করুন।`],
]

/** The Bangla version of a server message, or the message unchanged when none is known. */
export function serverMessageBn(message: string): string {
  const exact = EXACT[message] ?? EXACT[message.trim()]
  if (exact) return exact
  for (const [re, build] of PATTERNS) {
    const m = message.match(re)
    if (m) return build(m)
  }
  return message
}

/** Localize a server error message for the UI language. */
export function localizeServerMessage(message: string, lang: 'en' | 'bn'): string {
  return lang === 'bn' ? serverMessageBn(message) : message
}
