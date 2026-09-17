'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

interface PlayerAvatarProps {
  name: string
  photoUrl?: string | null
  className?: string
  fallbackClassName?: string
}

export function PlayerAvatar({ name, photoUrl, className, fallbackClassName }: PlayerAvatarProps) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
  return (
    <Avatar className={cn('h-10 w-10', className)}>
      {photoUrl ? <AvatarImage src={photoUrl} alt={name} /> : null}
      <AvatarFallback className={cn('bg-primary/10 text-primary font-semibold', fallbackClassName)}>
        {initials || '?'}
      </AvatarFallback>
    </Avatar>
  )
}

interface TeamAvatarProps {
  name: string
  color?: string | null
  logoUrl?: string | null
  className?: string
}

export function TeamAvatar({ name, color, logoUrl, className }: TeamAvatarProps) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
  return (
    <Avatar className={cn('h-10 w-10', className)}>
      {logoUrl ? <AvatarImage src={logoUrl} alt={name} /> : null}
      <AvatarFallback
        className="font-bold text-white"
        style={color ? { backgroundColor: color } : { backgroundColor: '#0F766E' }}
      >
        {initials || '?'}
      </AvatarFallback>
    </Avatar>
  )
}
