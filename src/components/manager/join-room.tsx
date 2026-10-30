'use client'

import { useState } from 'react'
import { ArrowRight, Gavel, Sparkles } from 'lucide-react'
import { navigate } from '@/lib/router'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { type Strings, useStrings } from '@/lib/i18n'

const STRINGS = {
  en: {
    title: 'Join an auction',
    subtitle: 'Enter the room code the organizer shared with you.',
    codeLabel: 'Room code',
    join: 'Join room',
    askOrganizer: 'Ask the organizer for the room code. Example: BD26-DEMO',
    noApp: 'Team managers bid live from their phone — no app needed, just this room code.',
    tryDemo: 'Try the demo room',
  },
  bn: {
    title: 'নিলামে যোগ দিন',
    subtitle: 'আয়োজক আপনাকে যে রুম কোড দিয়েছেন, সেটি লিখুন।',
    codeLabel: 'রুম কোড',
    join: 'রুমে যোগ দিন',
    askOrganizer: 'রুম কোডের জন্য আয়োজকের সাথে যোগাযোগ করুন। যেমন: BD26-DEMO',
    noApp: 'টিম ম্যানেজাররা নিজের ফোন থেকেই লাইভ বিড করেন — কোনো অ্যাপ লাগবে না, শুধু এই রুম কোড।',
    tryDemo: 'ডেমো রুম দেখুন',
  },
} satisfies Strings<{
  title: string
  subtitle: string
  codeLabel: string
  join: string
  askOrganizer: string
  noApp: string
  tryDemo: string
}>

export default function JoinRoomView() {
  const [code, setCode] = useState('')
  const t = useStrings(STRINGS)

  const clean = code.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 9)
  const valid = /^[A-Z]{2}\d{2}-[A-Z0-9]{4}$/.test(clean)

  return (
    <div className="container mx-auto flex min-h-[70vh] max-w-md items-center px-4 py-10">
      <Card className="w-full border-2 shadow-md">
        <CardContent className="flex flex-col items-center gap-5 p-6 sm:p-8 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground" aria-hidden>
            <Gavel className="h-7 w-7" />
          </span>
          <div>
            <h1 className="text-2xl font-black tracking-tight">{t.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t.subtitle}
            </p>
          </div>

          <div className="w-full space-y-3">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="BD26-XXXX"
              maxLength={9}
              aria-label={t.codeLabel}
              className="h-14 text-center font-mono text-xl font-black uppercase tracking-[0.3em]"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && valid) navigate(`/room/${clean}`)
              }}
            />
            <Button size="lg" className="h-13 w-full text-base font-black" disabled={!valid} onClick={() => navigate(`/room/${clean}`)}>
              {t.join} <ArrowRight className="ml-2 h-4.5 w-4.5" aria-hidden />
            </Button>
          </div>

          <div className="space-y-2 text-xs text-muted-foreground">
            <p>{t.askOrganizer}</p>
            <p className="text-[11px]">
              {t.noApp}
            </p>
          </div>

          <div className="w-full border-t pt-4">
            <Button variant="outline" className="h-11 w-full" onClick={() => navigate('/room/BD26-DEMO')}>
              <Sparkles className="mr-2 h-4 w-4 text-amber-500" aria-hidden />
              {t.tryDemo}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
