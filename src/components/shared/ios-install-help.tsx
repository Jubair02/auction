'use client'

// iPhone / iPad: Safari has no install button for web apps, so we explain the
// Share → Add to Home Screen steps. Loaded on demand (only when opened).
import { Share, SquarePlus } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { type Strings, useStrings } from '@/lib/i18n'

const STRINGS = {
  en: {
    title: 'Add NeelamGhor to your Home Screen',
    description: 'Open it like an app — full screen, one tap away.',
    step1: 'Tap the Share button in Safari’s toolbar.',
    step2: 'Scroll down and tap “Add to Home Screen”.',
    step3: 'Tap “Add”. NeelamGhor appears on your Home Screen.',
  },
  bn: {
    title: 'হোম স্ক্রিনে NeelamGhor যোগ করুন',
    description: 'অ্যাপের মতো খুলুন — পুরো স্ক্রিনে, এক ট্যাপেই।',
    step1: 'Safari-র নিচের/উপরের বারে শেয়ার বাটনে ট্যাপ করুন।',
    step2: 'নিচে স্ক্রল করে “Add to Home Screen” (হোম স্ক্রিনে যোগ করুন) ট্যাপ করুন।',
    step3: '“Add” ট্যাপ করুন — হোম স্ক্রিনে NeelamGhor চলে আসবে।',
  },
} satisfies Strings<Record<'title' | 'description' | 'step1' | 'step2' | 'step3', string>>

export default function IosInstallHelp({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useStrings(STRINGS)
  const steps = [
    { icon: Share, text: t.step1 },
    { icon: SquarePlus, text: t.step2 },
    { icon: null, text: t.step3 },
  ]
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </DialogHeader>
        <ol className="space-y-3">
          {steps.map(({ icon: Icon, text }, i) => (
            <li key={i} className="flex items-start gap-3 text-sm">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {i + 1}
              </span>
              <span className="pt-1">
                {text}
                {Icon ? <Icon className="ml-1.5 inline h-4 w-4 align-[-3px] text-primary" aria-hidden /> : null}
              </span>
            </li>
          ))}
        </ol>
      </DialogContent>
    </Dialog>
  )
}
