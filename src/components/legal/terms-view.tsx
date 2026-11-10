'use client'

import { useEffect, type ReactNode } from 'react'
import { AlertTriangle, ScrollText } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { AppLink } from '@/components/shared/app-link'
import { BackButton } from '@/components/shared/back-button'
import { useCachedGet } from '@/lib/api-cache'
import { formatBDT } from '@/lib/format'
import { type Lang, useLang } from '@/lib/i18n'
import { usePlanNumbers } from '@/lib/plan-numbers'

// Terms of Service and refund policy in English and Bangla. Like the privacy
// notice, it describes what the product actually does (one-time Pro per
// tournament, manual bKash / Nagad verification, organizers collect their own
// registration fees). It is a TEMPLATE: the refund rules are business choices,
// and the owner should have the whole page reviewed before relying on it.

interface Section {
  id?: string
  title: string
  body: ReactNode
}

const UPDATED = '9 November 2026'
const UPDATED_BN = '৯ নভেম্বর ২০২৬'

/** How long after Pro turns on a refund can be asked for (if the auction hasn't started). */
const REFUND_DAYS = 7

const link = (href: string, label: string) => (
  <AppLink href={href} className="font-medium text-primary underline underline-offset-4">
    {label}
  </AppLink>
)

function doc(lang: Lang, price: string, supportPhone: string | null) {
  const contact = (bn: boolean) =>
    supportPhone ? <strong>{supportPhone}</strong> : bn ? 'সাইটের সাপোর্ট' : 'the site’s support'

  if (lang === 'bn') {
    const list: Section[] = [
      {
        title: 'এই শর্তাবলি কী',
        body: (
          <p>
            NeelamGhor খেলাধুলার টুর্নামেন্টের জন্য লাইভ প্লেয়ার নিলাম, খেলোয়াড় নিবন্ধন, ফিকশ্চার ও ফলাফলের একটি অনলাইন সেবা। অ্যাকাউন্ট খুললে, নিলাম রুমে
            যোগ দিলে বা খেলোয়াড় হিসেবে নিবন্ধন করলে আপনি এই শর্তাবলি এবং আমাদের {link('/privacy', 'গোপনীয়তা নীতি')} মেনে নিচ্ছেন।
          </p>
        ),
      },
      {
        title: 'অ্যাকাউন্ট',
        body: (
          <ul>
            <li>সঠিক নাম ও ইমেইল দিন, এবং পাসওয়ার্ড গোপন রাখুন। আপনার অ্যাকাউন্ট থেকে যা করা হয় তার দায় আপনার।</li>
            <li>একটি অ্যাকাউন্ট একজন মানুষের জন্য। টিম ম্যানেজারের অ্যাকাউন্ট দিয়ে সেই দলের বাজেটে বিড হয়, তাই এটি অন্যকে দেবেন না।</li>
            <li>আপনার বয়স অন্তত ১৮ হতে হবে, অথবা অভিভাবকের অনুমতি থাকতে হবে।</li>
          </ul>
        ),
      },
      {
        title: 'আয়োজকের দায়িত্ব',
        body: (
          <ul>
            <li>যাঁদের নাম, ছবি ও ফোন নম্বর তুলছেন, তাঁদের সম্মতি নিয়েই তুলুন।</li>
            <li>
              খেলোয়াড়দের নিবন্ধন ফি, প্রাইজমানি বা দলের কাছ থেকে নেওয়া যেকোনো টাকা আয়োজক নিজে নেন ও দেন। NeelamGhor এই টাকা কখনো হাতে নেয় না; এর হিসাব ও
              ফেরত আয়োজক আর খেলোয়াড়/দলের মধ্যকার বিষয়।
            </li>
            <li>টুর্নামেন্ট দেশের আইন মেনে চালাতে হবে।</li>
          </ul>
        ),
      },
      {
        title: 'নিলামের বাজেট আসল টাকা নয়',
        body: (
          <p>
            নিলাম রুমের বাজেট ও বিড আয়োজকের ঠিক করা হিসাবের অঙ্ক। NeelamGhor দল, খেলোয়াড় বা আয়োজকের মধ্যে কোনো টাকা রাখে না বা পাঠায় না। এই সেবা জুয়া বা
            বাজি ধরার কাজে ব্যবহার করা যাবে না।
          </p>
        ),
      },
      {
        title: 'যা করা যাবে না',
        body: (
          <ul>
            <li>ভুয়া নিবন্ধন, বা অন্যের ফোন নম্বর দিয়ে নিবন্ধন করা।</li>
            <li>কাউকে হয়রানি করা, বা নাম/বিবরণে প্রতারণামূলক বা আপত্তিকর লেখা দেওয়া।</li>
            <li>সেবায় হামলা করা, অনুমতি ছাড়া অন্যের অ্যাকাউন্ট বা ডেটায় ঢোকার চেষ্টা করা, বা স্বয়ংক্রিয়ভাবে ডেটা তুলে নেওয়া।</li>
          </ul>
        ),
      },
      {
        title: 'ফ্রি ও Pro প্ল্যান',
        body: (
          <ul>
            <li>প্রতিটি টুর্নামেন্ট ফ্রি প্ল্যানে শুরু হয়, যেখানে দল ও খেলোয়াড়ের সংখ্যার সীমা আছে।</li>
            <li>
              Pro একটি টুর্নামেন্টের জন্য এককালীন পেমেন্ট (এখন {price})। এটি শুধু সেই টুর্নামেন্টের জন্য, অন্য টুর্নামেন্টে সরানো যায় না। কোনো মাসিক চার্জ নেই।
            </li>
            <li>
              পেমেন্ট bKash বা Nagad-এ হয়। আপনার দেওয়া ট্রানজেকশন আইডি যাচাইয়ের পর Pro চালু হয় — সাধারণত কয়েক ঘণ্টার মধ্যে। ভুল বা অযাচাইযোগ্য আইডি বাতিল হতে
              পারে।
            </li>
            <li>দাম ও ফ্রি প্ল্যানের সীমা বদলাতে পারে; যে টুর্নামেন্ট আগেই Pro, তার ওপর এর প্রভাব পড়বে না।</li>
          </ul>
        ),
      },
      {
        id: 'refunds',
        title: 'রিফান্ড নীতি',
        body: (
          <>
            <p>নিচের ক্ষেত্রে Pro-এর পুরো টাকা ফেরত দেওয়া হয়:</p>
            <ul>
              <li>আপনি টাকা পাঠিয়েছেন, কিন্তু Pro চালু হয়নি (পেমেন্ট বাতিল হয়েছে বা যাচাই করা যায়নি)।</li>
              <li>একই টুর্নামেন্টের জন্য দুবার, বা দামের চেয়ে বেশি টাকা পাঠিয়েছেন — বাড়তি অংশ ফেরত।</li>
              <li>Pro চালুর {REFUND_DAYS} দিনের মধ্যে চেয়েছেন, এবং টুর্নামেন্টের নিলাম তখনও শুরু হয়নি।</li>
              <li>আমাদের দিকের কোনো ত্রুটিতে আপনার নিলাম চালানো যায়নি এবং আমরা সময়মতো ঠিক করতে পারিনি।</li>
            </ul>
            <p>নিলাম শুরু হয়ে গেলে, বা উপরের সময় পেরিয়ে গেলে, সাধারণত রিফান্ড দেওয়া হয় না — কারণ ততক্ষণে Pro ফিচার ব্যবহার হয়ে গেছে।</p>
            <p>
              রিফান্ড চাইতে {contact(true)}-এ যোগাযোগ করুন, সাথে টুর্নামেন্টের নাম ও ট্রানজেকশন আইডি দিন। টাকা যে bKash/Nagad নম্বর থেকে এসেছে সেখানেই ৭ কর্মদিবসের
              মধ্যে ফেরত যায়।
            </p>
            <p>খেলোয়াড়েরা আয়োজককে যে নিবন্ধন ফি দেন, তা NeelamGhor পায় না — সেই ফি ফেরতের জন্য আয়োজকের সাথে যোগাযোগ করুন।</p>
          </>
        ),
      },
      {
        title: 'সেবার প্রাপ্যতা',
        body: (
          <p>
            আমরা সেবা সবসময় চালু রাখার চেষ্টা করি, কিন্তু নিরবচ্ছিন্ন থাকবে — এমন নিশ্চয়তা দিতে পারি না। ইন্টারনেট বা সার্ভারের সমস্যায় নিলাম থেমে যেতে পারে; তখন
            রুম নিজে থেকে বিরতিতে যায় এবং আয়োজক আবার চালু করতে পারেন। গুরুত্বপূর্ণ ফলাফল এক্সপোর্ট করে রাখুন।
          </p>
        ),
      },
      {
        title: 'আপনার দেওয়া কনটেন্ট',
        body: (
          <p>
            আপনি যে নাম, ছবি, লোগো ও লেখা দেন তার মালিকানা আপনারই। সেবা চালানোর জন্য — যেমন নিলাম রুম, পাবলিক ফলাফল পেজ ও শেয়ার কার্ডে দেখাতে — সেগুলো সংরক্ষণ
            ও প্রদর্শনের অনুমতি আপনি আমাদের দিচ্ছেন।
          </p>
        ),
      },
      {
        title: 'অ্যাকাউন্ট স্থগিত বা বন্ধ',
        body: (
          <p>
            এই শর্ত ভাঙলে আমরা কনটেন্ট সরাতে বা অ্যাকাউন্ট ব্লক করতে পারি। আপনি যেকোনো সময় {link('/account', 'আমার অ্যাকাউন্ট')} পেজ থেকে নিজের অ্যাকাউন্ট মুছে ফেলতে
            পারেন।
          </p>
        ),
      },
      {
        title: 'দায়ের সীমা',
        body: (
          <p>
            আইন যতটুকু অনুমতি দেয়, এই সেবা ব্যবহারের ফলে কোনো ক্ষতির জন্য আমাদের দায় সর্বোচ্চ সেই অঙ্ক পর্যন্ত, যা দাবির আগের ১২ মাসে আপনি আমাদের দিয়েছেন।
          </p>
        ),
      },
      {
        title: 'পরিবর্তন ও প্রযোজ্য আইন',
        body: (
          <p>
            আমরা এই শর্তাবলি হালনাগাদ করতে পারি; বড় পরিবর্তন সাইটে জানানো হবে। হালনাগাদের পর সেবা ব্যবহার চালিয়ে গেলে নতুন শর্ত মেনে নিয়েছেন বলে ধরা হবে। এই
            শর্তাবলি বাংলাদেশের আইন অনুযায়ী চলবে।
          </p>
        ),
      },
      {
        title: 'যোগাযোগ',
        body: <p>যেকোনো প্রশ্ন, অভিযোগ বা রিফান্ডের অনুরোধে যোগাযোগ করুন: {contact(true)}।</p>,
      },
    ]
    return {
      title: 'ব্যবহারের শর্তাবলি ও রিফান্ড নীতি',
      intro: 'NeelamGhor ব্যবহারের নিয়ম, Pro প্ল্যানের পেমেন্ট এবং কখন টাকা ফেরত পাবেন — সহজ ভাষায়।',
      template: 'এটি একটি খসড়া টেমপ্লেট। প্রকাশের আগে সাইটের মালিককে এটি একজন আইনজ্ঞকে দিয়ে যাচাই করিয়ে নিতে হবে।',
      updated: `সর্বশেষ হালনাগাদ: ${UPDATED_BN}`,
      list,
    }
  }

  const list: Section[] = [
    {
      title: 'What these terms cover',
      body: (
        <p>
          NeelamGhor is an online service for running live player auctions, player registration, fixtures and results for sports
          tournaments. By creating an account, joining an auction room or registering as a player, you agree to these terms and
          our {link('/privacy', 'privacy notice')}.
        </p>
      ),
    },
    {
      title: 'Accounts',
      body: (
        <ul>
          <li>Give your real name and email and keep your password private. You are responsible for what is done with your account.</li>
          <li>One account is for one person. A team manager account bids with that team’s budget, so never share it.</li>
          <li>You must be at least 18, or have a parent’s or guardian’s permission.</li>
        </ul>
      ),
    },
    {
      title: 'What organizers are responsible for',
      body: (
        <ul>
          <li>Only add people’s names, photos and phone numbers with their permission.</li>
          <li>
            Organizers collect and pay any registration fees, prize money or team payments themselves. NeelamGhor never handles that
            money; accounting for it and refunding it is between the organizer and the players or teams.
          </li>
          <li>Run your tournament lawfully.</li>
        </ul>
      ),
    },
    {
      title: 'Auction budgets are not money',
      body: (
        <p>
          Budgets and bids in an auction room are figures set by the organizer. NeelamGhor does not hold or move money between
          teams, players or organizers. The service must not be used for gambling or betting.
        </p>
      ),
    },
    {
      title: 'What you must not do',
      body: (
        <ul>
          <li>Register fake players, or register with someone else’s phone number.</li>
          <li>Harass anyone, or put misleading or offensive text in names and descriptions.</li>
          <li>Attack the service, try to get into accounts or data that aren’t yours, or scrape data automatically.</li>
        </ul>
      ),
    },
    {
      title: 'Free and Pro plans',
      body: (
        <ul>
          <li>Every tournament starts on the Free plan, which limits the number of teams and players.</li>
          <li>
            Pro is a one-time payment per tournament (currently {price}). It applies to that tournament only and can’t be moved to
            another one. There is no subscription.
          </li>
          <li>
            You pay with bKash or Nagad. Pro turns on once we have checked the Transaction ID you give us — usually within a few
            hours. A wrong or unverifiable ID may be rejected.
          </li>
          <li>Prices and Free limits may change; a tournament that is already on Pro keeps it.</li>
        </ul>
      ),
    },
    {
      id: 'refunds',
      title: 'Refund policy',
      body: (
        <>
          <p>You get the Pro fee back in full when:</p>
          <ul>
            <li>You paid but Pro was not turned on (the payment was rejected or could not be verified).</li>
            <li>You paid twice for the same tournament, or more than the price — the extra is returned.</li>
            <li>You ask within {REFUND_DAYS} days of Pro turning on, and the tournament’s auction has not started yet.</li>
            <li>A fault on our side stopped your auction from running and we could not fix it in time.</li>
          </ul>
          <p>Once the auction has started, or after that period, we normally don’t refund — the Pro features have been used.</p>
          <p>
            To ask for a refund, contact {contact(false)} with the tournament’s name and the Transaction ID. The money goes back to the
            bKash / Nagad number it came from within 7 working days.
          </p>
          <p>Registration fees players pay to an organizer never reach NeelamGhor — ask the organizer about refunding those.</p>
        </>
      ),
    },
    {
      title: 'Availability',
      body: (
        <p>
          We work to keep the service running but can’t promise it will never be interrupted. A connection or server problem can stop
          an auction; the room then pauses itself and the organizer can resume it. Export results you need to keep.
        </p>
      ),
    },
    {
      title: 'Your content',
      body: (
        <p>
          You keep ownership of the names, photos, logos and text you add. You allow us to store and show them as needed to run the
          service — for example in auction rooms, public results pages and share cards.
        </p>
      ),
    },
    {
      title: 'Suspension and closing your account',
      body: (
        <p>
          If these terms are broken we may remove content or block the account. You can delete your own account at any time from{' '}
          {link('/account', 'My account')}.
        </p>
      ),
    },
    {
      title: 'Limit of liability',
      body: (
        <p>
          As far as the law allows, our liability for any loss from using the service is limited to what you paid us in the 12 months
          before the claim.
        </p>
      ),
    },
    {
      title: 'Changes and governing law',
      body: (
        <p>
          We may update these terms; important changes will be announced on the site. Using the service after an update means you
          accept the new terms. These terms are governed by the laws of Bangladesh.
        </p>
      ),
    },
    {
      title: 'Contact',
      body: <p>For questions, complaints or refund requests, contact {contact(false)}.</p>,
    },
  ]
  return {
    title: 'Terms of Service & refund policy',
    intro: 'The rules for using NeelamGhor, how Pro payments work and when you get your money back — in plain language.',
    template: 'This is a draft template. The site owner should have it reviewed by a lawyer before relying on it.',
    updated: `Last updated: ${UPDATED}`,
    list,
  }
}

export default function TermsView() {
  const lang = useLang()
  const plans = usePlanNumbers()
  const { data } = useCachedGet<{ settings: Record<string, string> }>('/api/settings')
  const supportPhone = data?.settings?.supportPhone?.trim() || null
  const page = doc(lang, formatBDT(plans.proPrice), supportPhone)

  // /terms#refunds (linked from pricing and the upgrade dialog) opens at that section.
  useEffect(() => {
    if (window.location.hash === '#refunds') document.getElementById('refunds')?.scrollIntoView()
  }, [])

  return (
    <article className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <header className="space-y-2">
        <BackButton className="mb-1" />
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <ScrollText className="h-6 w-6 text-primary" aria-hidden /> {page.title}
        </h1>
        <p className="text-sm text-muted-foreground">{page.updated}</p>
        <p className="text-muted-foreground">{page.intro}</p>
      </header>

      <Card className="border-amber-300 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/40">
        <CardContent className="flex items-start gap-3 p-4 text-sm text-amber-900 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>{page.template}</p>
        </CardContent>
      </Card>

      {page.list.map((s) => (
        <section key={s.title} id={s.id} className="scroll-mt-20 space-y-2">
          <h2 className="text-lg font-semibold">{s.title}</h2>
          <div className="space-y-2 text-sm leading-relaxed text-foreground/90 [&_li]:pl-1 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
            {s.body}
          </div>
        </section>
      ))}
    </article>
  )
}
