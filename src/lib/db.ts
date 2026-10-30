import { createResilientClient, type ResilientClient } from '@/lib/db-resilience'

const globalForPrisma = globalThis as unknown as {
  prisma: ResilientClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  createResilientClient({
    // Query logging is a development aid — in production it floods the logs and
    // echoes row data (emails, phone numbers) into stdout.
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['query', 'error', 'warn'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
