'use client'

import { useState } from 'react'
import type { CSSProperties } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useLowData } from '@/lib/low-data'
import { cn } from '@/lib/utils'

// Every player photo / team logo avatar in the app goes through these two
// components. In low-data mode (lib/low-data.ts) they show initials on the
// colour instead, so no image is downloaded.
//
// The photo is a native <img loading="lazy">, not Radix's AvatarImage: Radix
// preloads every image with `new Image()` the moment it renders, so a list of
// 300 players downloaded 300 photos up front, even the ones far off-screen.
// Here only photos near the viewport load. As before, the initials show until
// the photo has loaded, and stay if it fails.

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

function AvatarWithPhoto({
  name,
  src,
  className,
  fallbackClassName,
  fallbackStyle,
}: {
  name: string
  src: string | null
  className?: string
  fallbackClassName?: string
  fallbackStyle?: CSSProperties
}) {
  // Keyed on the URL, so a new photo starts over from the initials.
  const [status, setStatus] = useState<{ src: string | null; state: 'loading' | 'loaded' | 'error' }>({ src, state: 'loading' })
  const state = status.src === src ? status.state : 'loading'
  const loaded = state === 'loaded'
  return (
    <Avatar className={cn('h-10 w-10', className)}>
      <AvatarFallback className={fallbackClassName} style={fallbackStyle} aria-hidden={loaded || undefined}>
        {initialsOf(name) || '?'}
      </AvatarFallback>
      {src && state !== 'error' ? (
        <img
          src={src}
          alt={name}
          loading="lazy"
          decoding="async"
          // A photo already in the cache can finish before React attaches onLoad.
          ref={(el) => {
            if (el?.complete && el.naturalWidth > 0 && !loaded) setStatus({ src, state: 'loaded' })
          }}
          onLoad={() => setStatus({ src, state: 'loaded' })}
          onError={() => setStatus({ src, state: 'error' })}
          className={cn('absolute inset-0 aspect-square size-full', loaded ? 'opacity-100' : 'opacity-0')}
        />
      ) : null}
    </Avatar>
  )
}

interface PlayerAvatarProps {
  name: string
  photoUrl?: string | null
  className?: string
  fallbackClassName?: string
}

export function PlayerAvatar({ name, photoUrl, className, fallbackClassName }: PlayerAvatarProps) {
  const lowData = useLowData()
  return (
    <AvatarWithPhoto
      name={name}
      src={photoUrl && !lowData ? photoUrl : null}
      className={className}
      fallbackClassName={cn('bg-primary/10 text-primary font-semibold', fallbackClassName)}
    />
  )
}

interface TeamAvatarProps {
  name: string
  color?: string | null
  logoUrl?: string | null
  className?: string
}

export function TeamAvatar({ name, color, logoUrl, className }: TeamAvatarProps) {
  const lowData = useLowData()
  return (
    <AvatarWithPhoto
      name={name}
      src={logoUrl && !lowData ? logoUrl : null}
      className={className}
      fallbackClassName="font-bold text-white"
      fallbackStyle={color ? { backgroundColor: color } : { backgroundColor: '#0F766E' }}
    />
  )
}
