'use client'

import type { ReactNode } from 'react'
import { AlertTriangle, ShieldCheck } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { AppLink } from '@/components/shared/app-link'
import { BackButton } from '@/components/shared/back-button'
import { useCachedGet } from '@/lib/api-cache'
import { type Lang, useLang } from '@/lib/i18n'

// A plain-language privacy notice in English and Bangla. It describes what the
// code actually does (see src/lib/notify.ts, the outbox retention sweep in
// mini-services/auction-service/outbox.ts and /api/account). It is a TEMPLATE:
// the owner should have it reviewed before relying on it.

interface Section {
  title: string
  body: ReactNode
}

const UPDATED = '9 November 2026'
const UPDATED_BN = '৯ নভেম্বর ২০২৬'

const accountLink = (label: string) => (
  <AppLink href="/account" className="font-medium text-primary underline underline-offset-4">
    {label}
  </AppLink>
)

function sections(lang: Lang, supportPhone: string | null): { title: string; intro: string; template: string; updated: string; list: Section[] } {
  if (lang === 'bn') {
    return {
      title: 'গোপনীয়তা নীতি',
      intro:
        'NeelamGhor খেলাধুলার লিগের জন্য লাইভ প্লেয়ার নিলাম চালানোর একটি প্ল্যাটফর্ম। আমরা কোন তথ্য রাখি, কেন রাখি, কে দেখতে পায় এবং কতদিন রাখি — তা এখানে সহজ ভাষায় লেখা হলো।',
      template:
        'এটি একটি খসড়া টেমপ্লেট। প্রকাশের আগে সাইটের মালিককে এটি একজন আইনজ্ঞকে দিয়ে যাচাই করিয়ে নিতে হবে।',
      updated: `সর্বশেষ হালনাগাদ: ${UPDATED_BN}`,
      list: [
        {
          title: 'আমরা কোন তথ্য সংগ্রহ করি',
          body: (
            <ul>
              <li>
                <strong>অ্যাকাউন্ট:</strong> নাম, ইমেইল, ফোন নম্বর (ঐচ্ছিক), পাসওয়ার্ড (শুধু এনক্রিপ্ট করা হ্যাশ) এবং ভূমিকা
                (আয়োজক বা টিম ম্যানেজার)।
              </li>
              <li>
                <strong>খেলোয়াড়:</strong> নাম, ফোন নম্বর, ছবি, খেলার ভূমিকা ও আগের দল — আয়োজক যোগ করেন, অথবা খেলোয়াড় নিজে
                নিবন্ধন লিংকে দেন। নিজে নিবন্ধন করলে SMS পেতে সম্মতি দিয়েছেন কি না, সেটিও রাখা হয়।
              </li>
              <li>
                <strong>পেমেন্ট:</strong> bKash / Nagad-এর ট্রানজেকশন আইডি, প্রেরকের নম্বর, টাকার পরিমাণ ও নাম — Pro প্ল্যান
                এবং আয়োজকের নেওয়া নিবন্ধন ফি যাচাইয়ের জন্য।
              </li>
              <li>
                <strong>লাইভ নিলাম রুম:</strong> লগইন করা দর্শকের অ্যাকাউন্টের নাম (লগইন ছাড়া দর্শকের কোনো নাম রাখা হয় না), এবং সব বিড
                (নিলামের হিসাবের জন্য)।
              </li>
              <li>
                <strong>কারিগরি:</strong> লগইন সেশনের রেকর্ড, অপব্যবহার ঠেকাতে স্বল্পমেয়াদি অনুরোধ-গণনা (IP ঠিকানার ভিত্তিতে),
                এবং “টুর্নামেন্ট তৈরি হয়েছে”-এর মতো পণ্য-ইভেন্ট। লগইনের কুকি ছাড়া আর কোনো কুকি নেই; কোনো বিজ্ঞাপন বা
                তৃতীয় পক্ষের ট্র্যাকার নেই।
              </li>
            </ul>
          ),
        },
        {
          title: 'কেন সংগ্রহ করি',
          body: (
            <ul>
              <li>টুর্নামেন্ট ও লাইভ নিলাম চালাতে, এবং আয়োজক যেন তাঁর খেলোয়াড়দের সাথে যোগাযোগ করতে পারেন।</li>
              <li>পেমেন্ট যাচাই করতে ও Pro ফিচার চালু করতে।</li>
              <li>অ্যাকাউন্ট সুরক্ষিত রাখতে ও অপব্যবহার ঠেকাতে।</li>
              <li>মোট সংখ্যার হিসাব দেখে পরিষেবা উন্নত করতে। আমরা আপনার তথ্য বিক্রি করি না।</li>
            </ul>
          ),
        },
        {
          title: 'কে দেখতে পায়',
          body: (
            <ul>
              <li>
                <strong>আয়োজক</strong> (ও তাঁর সহ-আয়োজকেরা) নিজের টুর্নামেন্টের খেলোয়াড় ও নিবন্ধনকারীদের ফোন নম্বর এবং
                পেমেন্টের তথ্য দেখতে পান।
              </li>
              <li>
                <strong>টিম ম্যানেজার, নিলামের দর্শক ও পাবলিক পেজ</strong> (ফলাফল, নিবন্ধন, নিলাম রুম, স্ট্রিম ওভারলে) খেলোয়াড়ের
                নাম, ছবি, ভূমিকা ও দাম দেখায় — কখনো ফোন নম্বর নয়।
              </li>
              <li>
                <strong>NeelamGhor অ্যাডমিন</strong> সহায়তা ও পেমেন্ট যাচাইয়ের প্রয়োজনে তথ্য দেখতে পারেন।
              </li>
              <li>
                <strong>সেবা-প্রদানকারী:</strong> হোস্টিং ও ডাটাবেস, ইমেইল পাঠানোর সেবা, আর SMS চালু থাকলে SMS গেটওয়ে — শুধু
                নিজের কাজটুকুর জন্য।
              </li>
            </ul>
          ),
        },
        {
          title: 'SMS',
          body: (
            <p>
              SMS যায় শুধু সেই Pro টুর্নামেন্ট থেকে, যেখানে আয়োজক SMS চালু করেছেন: নিবন্ধনের সিদ্ধান্ত, আয়োজকের পাঠানো নিলামের
              রিমাইন্ডার, আর “আপনি বিক্রি হয়েছেন”। যে খেলোয়াড় নিজে নিবন্ধন করে SMS-এ সম্মতি দেননি, তাঁকে কখনো SMS পাঠানো হয়
              না। আমরা কোনো বিজ্ঞাপনী SMS পাঠাই না।
            </p>
          ),
        },
        {
          title: 'কতদিন রাখি',
          body: (
            <ul>
              <li>বাতিল হওয়া খেলোয়াড়-নিবন্ধন: ৯০ দিন পর মুছে ফেলা হয়।</li>
              <li>SMS পাঠানোর লগ: ১৮০ দিন পর মুছে ফেলা হয়।</li>
              <li>কোথাও ব্যবহৃত হচ্ছে না এমন আপলোড করা ছবি: ৭ দিন পর মুছে ফেলা হয়।</li>
              <li>মেয়াদ শেষ বা বাতিল হওয়া লগইন সেশন: ৩০ দিন পর মুছে ফেলা হয়।</li>
              <li>
                বিড ও পেমেন্টের রেকর্ড হিসাব রাখার জন্য থেকে যায়; অ্যাকাউন্ট মুছে ফেললে সেখানে আপনার নামের বদলে “Deleted user”
                দেখায়।
              </li>
            </ul>
          ),
        },
        {
          title: 'আপনার তথ্য ডাউনলোড বা মুছে ফেলা',
          body: (
            <p>
              লগইন করে {accountLink('আমার অ্যাকাউন্ট')} পেজ থেকে আপনার সব তথ্য একটি ফাইলে ডাউনলোড করতে পারেন, অথবা অ্যাকাউন্ট
              মুছে ফেলতে পারেন। খেলোয়াড় হিসেবে আপনার তথ্য সরাতে চাইলে টুর্নামেন্টের আয়োজকের সাথে বা আমাদের সাথে যোগাযোগ করুন।
            </p>
          ),
        },
        {
          title: 'যোগাযোগ',
          body: (
            <p>
              গোপনীয়তা নিয়ে যেকোনো প্রশ্ন বা অনুরোধে{' '}
              {supportPhone ? (
                <>
                  আমাদের সাপোর্ট নম্বরে কল করুন: <strong>{supportPhone}</strong>।
                </>
              ) : (
                'সাইটের সাপোর্টে যোগাযোগ করুন।'
              )}
            </p>
          ),
        },
      ],
    }
  }
  return {
    title: 'Privacy notice',
    intro:
      'NeelamGhor is a platform for running live player auctions for sports leagues. This page explains, in plain language, what we keep, why, who can see it and for how long.',
    template: 'This is a draft template. The site owner should have it reviewed by a lawyer before relying on it.',
    updated: `Last updated: ${UPDATED}`,
    list: [
      {
        title: 'What we collect',
        body: (
          <ul>
            <li>
              <strong>Accounts:</strong> name, email, phone number (optional), password (stored only as a one-way hash) and
              role (organizer or team manager).
            </li>
            <li>
              <strong>Players:</strong> name, phone number, photo, playing role and previous team — added by the organizer, or
              given by the player on a registration link. Self-registered players also choose whether they agree to SMS.
            </li>
            <li>
              <strong>Payments:</strong> bKash / Nagad Transaction IDs, sender numbers, amounts and names — to verify Pro plans
              and the registration fees organizers collect.
            </li>
            <li>
              <strong>Live auction rooms:</strong> a signed-in viewer’s account name (viewers who aren’t signed in watch
              anonymously), and every bid (the auction’s audit trail).
            </li>
            <li>
              <strong>Technical:</strong> login session records, short-lived request counters keyed on IP address to stop abuse,
              and product events such as “tournament created”. No cookies other than the login cookie; no ads or third-party
              trackers.
            </li>
          </ul>
        ),
      },
      {
        title: 'Why',
        body: (
          <ul>
            <li>To run tournaments and live auctions, and to let organizers reach their players.</li>
            <li>To verify payments and unlock Pro features.</li>
            <li>To keep accounts secure and prevent abuse.</li>
            <li>To improve the service from aggregate counts. We do not sell your data.</li>
          </ul>
        ),
      },
      {
        title: 'Who can see it',
        body: (
          <ul>
            <li>
              <strong>Organizers</strong> (and their co-organizers) see the phone numbers and payment details of their own
              tournament’s players and registrants.
            </li>
            <li>
              <strong>Team managers, auction viewers and public pages</strong> (results, registration, auction room, stream
              overlay) show players’ names, photos, roles and prices — never phone numbers.
            </li>
            <li>
              <strong>NeelamGhor admins</strong> can access data when needed for support and payment verification.
            </li>
            <li>
              <strong>Service providers:</strong> hosting and database, the email service, and — when SMS is on — the SMS
              gateway, each only for its own job.
            </li>
          </ul>
        ),
      },
      {
        title: 'SMS',
        body: (
          <p>
            Texts are only sent for Pro tournaments whose organizer turned SMS on: registration decisions, an auction reminder
            the organizer sends, and “you were sold”. Players who registered themselves without agreeing to SMS are never
            texted. We never send marketing SMS.
          </p>
        ),
      },
      {
        title: 'How long we keep it',
        body: (
          <ul>
            <li>Rejected player registrations: deleted after 90 days.</li>
            <li>SMS delivery log: deleted after 180 days.</li>
            <li>Uploaded images no longer used anywhere: deleted after 7 days.</li>
            <li>Expired or signed-out login sessions: deleted after 30 days.</li>
            <li>
              Bid and payment records stay for the accounts of each tournament; if you delete your account they show “Deleted
              user” instead of your name.
            </li>
          </ul>
        ),
      },
      {
        title: 'Download or delete your data',
        body: (
          <p>
            Logged in, open {accountLink('My account')} to download everything we hold about you as one file, or to delete your
            account. If you are a player and want your details removed, contact the tournament’s organizer or us.
          </p>
        ),
      },
      {
        title: 'Contact',
        body: (
          <p>
            For any privacy question or request,{' '}
            {supportPhone ? (
              <>
                call our support number: <strong>{supportPhone}</strong>.
              </>
            ) : (
              'contact the site’s support.'
            )}
          </p>
        ),
      },
    ],
  }
}

export default function PrivacyView() {
  const lang = useLang()
  const { data } = useCachedGet<{ settings: Record<string, string> }>('/api/settings')
  const supportPhone = data?.settings?.supportPhone?.trim() || null
  const doc = sections(lang, supportPhone)

  return (
    <article className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <header className="space-y-2">
        <BackButton className="mb-1" />
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <ShieldCheck className="h-6 w-6 text-primary" aria-hidden /> {doc.title}
        </h1>
        <p className="text-sm text-muted-foreground">{doc.updated}</p>
        <p className="text-muted-foreground">{doc.intro}</p>
      </header>

      <Card className="border-amber-300 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/40">
        <CardContent className="flex items-start gap-3 p-4 text-sm text-amber-900 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>{doc.template}</p>
        </CardContent>
      </Card>

      {doc.list.map((s) => (
        <section key={s.title} className="space-y-2">
          <h2 className="text-lg font-semibold">{s.title}</h2>
          <div className="space-y-2 text-sm leading-relaxed text-foreground/90 [&_li]:pl-1 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
            {s.body}
          </div>
        </section>
      ))}
    </article>
  )
}
