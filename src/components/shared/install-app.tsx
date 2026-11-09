'use client'

// "Install app": a header-menu item for everyone the browser lets install, and
// a small dismissible hint for organizers / managers on phones. iOS Safari gets
// "Add to Home Screen" steps instead (it has no install prompt).
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { Download, X } from 'lucide-react'
import { create } from 'zustand'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { type Strings, useStrings } from '@/lib/i18n'
import { useInstallPrompt } from '@/lib/pwa'

const IosInstallHelp = dynamic(() => import('@/components/shared/ios-install-help'))

const HINT_DISMISSED_KEY = 'ng_install_hint_dismissed'

const STRINGS = {
  en: {
    installApp: 'Install app',
    addToHome: 'Add to Home Screen',
    hint: 'Install NeelamGhor on your phone — opens in one tap, full screen.',
    install: 'Install',
    howTo: 'How?',
    dismiss: 'Dismiss',
    installed: 'NeelamGhor is installed — find it on your home screen.',
  },
  bn: {
    installApp: 'অ্যাপ ইনস্টল করুন',
    addToHome: 'হোম স্ক্রিনে যোগ করুন',
    hint: 'ফোনে NeelamGhor ইনস্টল করুন — এক ট্যাপে খুলবে, পুরো স্ক্রিনে।',
    install: 'ইনস্টল',
    howTo: 'কীভাবে?',
    dismiss: 'বন্ধ করুন',
    installed: 'NeelamGhor ইনস্টল হয়েছে — হোম স্ক্রিনে খুঁজে নিন।',
  },
} satisfies Strings<Record<'installApp' | 'addToHome' | 'hint' | 'install' | 'howTo' | 'dismiss' | 'installed', string>>

// The iOS steps dialog lives outside the dropdown (which unmounts when it closes).
const useIosHelp = create<{ open: boolean; setOpen: (open: boolean) => void }>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}))

/** Mount once in the shell: the iOS "Add to Home Screen" dialog (loaded only when opened). */
export function InstallHelpHost() {
  const { open, setOpen } = useIosHelp()
  // Keep it mounted after the first open so the close animation can play.
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    if (open) setLoaded(true)
  }, [open])
  return loaded || open ? <IosInstallHelp open={open} onOpenChange={setOpen} /> : null
}

function useInstallAction() {
  const { mode, install } = useInstallPrompt()
  const t = useStrings(STRINGS)
  const run = async () => {
    if (mode === 'ios') useIosHelp.getState().setOpen(true)
    else if (mode === 'prompt' && (await install())) toast.success(t.installed)
  }
  return { mode, run, t }
}

/** "Install app" / "Add to Home Screen" for the header's account menu; nothing when not installable. */
export function InstallAppMenuItem() {
  const { mode, run, t } = useInstallAction()
  if (!mode) return null
  return (
    <DropdownMenuItem onSelect={() => void run()}>
      <Download className="mr-2 h-4 w-4" /> {mode === 'ios' ? t.addToHome : t.installApp}
    </DropdownMenuItem>
  )
}

/** Small dismissible install hint, phones only (hidden from md up). */
export function InstallHint() {
  const { mode, run, t } = useInstallAction()
  // Read after mount (hydration-safe); hidden until then.
  const [dismissed, setDismissed] = useState(true)
  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(HINT_DISMISSED_KEY) === '1')
    } catch {
      setDismissed(false)
    }
  }, [])

  if (!mode || dismissed) return null
  const dismiss = () => {
    setDismissed(true)
    try {
      localStorage.setItem(HINT_DISMISSED_KEY, '1')
    } catch {
      // ignore — hidden for this page view
    }
  }
  return (
    <div className="border-b bg-primary/5 md:hidden print:hidden" role="region" aria-label={t.installApp}>
      <div className="container mx-auto flex max-w-7xl items-center gap-2 px-4 py-2 text-sm">
        <Download className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        <p className="min-w-0 flex-1 leading-snug">{t.hint}</p>
        <Button size="sm" className="h-8 shrink-0" onClick={() => void run()}>
          {mode === 'ios' ? t.howTo : t.install}
        </Button>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t.dismiss}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}
