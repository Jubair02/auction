'use client'

import { useState } from 'react'
import { ArrowRight, Gavel, Sparkles } from 'lucide-react'
import { navigate } from '@/lib/router'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

export default function JoinRoomView() {
  const [code, setCode] = useState('')

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
            <h1 className="text-2xl font-black tracking-tight">Join an auction</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter the room code the organizer shared with you.
            </p>
          </div>

          <div className="w-full space-y-3">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="BD26-XXXX"
              maxLength={9}
              aria-label="Room code"
              className="h-14 text-center font-mono text-xl font-black uppercase tracking-[0.3em]"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && valid) navigate(`/room/${clean}`)
              }}
            />
            <Button size="lg" className="h-13 w-full text-base font-black" disabled={!valid} onClick={() => navigate(`/room/${clean}`)}>
              Join room <ArrowRight className="ml-2 h-4.5 w-4.5" aria-hidden />
            </Button>
          </div>

          <div className="space-y-2 text-xs text-muted-foreground">
            <p>Ask the organizer for the room code. Example: BD26-DEMO</p>
            <p className="text-[11px]">
              Team managers bid live from their phone — no app needed, just this room code.
            </p>
          </div>

          <div className="w-full border-t pt-4">
            <Button variant="outline" className="h-11 w-full" onClick={() => navigate('/room/BD26-DEMO')}>
              <Sparkles className="mr-2 h-4 w-4 text-amber-500" aria-hidden />
              Try the demo room
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
