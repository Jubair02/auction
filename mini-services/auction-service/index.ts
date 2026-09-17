// ============================================================
// NeelamGhor — live auction socket mini-service (port 3003)
// Event routing + token auth. The game logic lives in engine.ts.
// ============================================================
import './env' // MUST be first: loads DATABASE_URL / AUCTION_SECRET from the parent .env
import { createServer } from 'node:http'
import { Server, type Socket } from 'socket.io'
import { PrismaClient } from '@prisma/client'
import { verifyToken } from '../../src/lib/crypto'
import type { RoomState, SocketIdentity } from '../../src/lib/types'
import { AuctionEngine } from './engine'

const db = new PrismaClient()
const httpServer = createServer()
const io = new Server(httpServer, {
  path: '/', // DO NOT change — Caddy gateway requires this exact path
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
})
const engine = new AuctionEngine(io, db)

const emitError = (socket: Socket, message: string) => socket.emit('error', { message })

interface JoinAck {
  ok: boolean
  error?: string
  state?: RoomState
}

io.on('connection', (socket) => {
  socket.on('join_room', async (data: { roomCode?: string; token?: string }, ack?: (res: JoinAck) => void) => {
    try {
      const roomCode = String(data?.roomCode ?? '').trim().toUpperCase()
      const token = String(data?.token ?? '')
      if (!roomCode || !token) return ack?.({ ok: false, error: 'roomCode and token are required' })

      const identity = verifyToken<SocketIdentity>(token)
      if (!identity || !identity.auctionId) return ack?.({ ok: false, error: 'Invalid or expired token' })

      const auction = await db.auction.findUnique({ where: { roomCode } })
      if (!auction) return ack?.({ ok: false, error: 'Room not found' })
      if (identity.auctionId !== auction.id) return ack?.({ ok: false, error: 'Token is not valid for this room' })

      const state = await engine.joinRoom(socket, identity, auction.id)
      socket.join(`auction:${auction.id}`)
      socket.data.identity = identity
      return ack?.({ ok: true, state })
    } catch (err) {
      console.error('[auction-service] join_room failed:', err)
      return ack?.({ ok: false, error: 'Join failed' })
    }
  })

  socket.on('place_bid', async (data: { amount?: unknown }) => {
    try {
      const identity = socket.data.identity as SocketIdentity | undefined
      if (!identity) return emitError(socket, 'Join the room first')
      if (identity.role !== 'MANAGER') return emitError(socket, 'Only team managers can bid')
      await engine.placeBid(socket, identity, data?.amount)
    } catch (err) {
      console.error('[auction-service] place_bid failed:', err)
      emitError(socket, 'Bid failed — try again')
    }
  })

  socket.on('organizer_action', async (data: { action?: string; payload?: Record<string, unknown> }) => {
    try {
      const identity = socket.data.identity as SocketIdentity | undefined
      if (!identity) return emitError(socket, 'Join the room first')
      if (identity.role !== 'ORGANIZER') return emitError(socket, 'Only the organizer can perform this action')
      await engine.organizerAction(socket, identity, data?.action, data?.payload)
    } catch (err) {
      console.error('[auction-service] organizer_action failed:', err)
      emitError(socket, 'Action failed — try again')
    }
  })

  socket.on('disconnect', () => {
    void engine.leave(socket)
  })
})

httpServer.listen(3003, () => {
  console.log('[auction-service] live auction engine listening on http://localhost:3003 (path "/")')
})

// Graceful shutdown
let shuttingDown = false
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`[auction-service] ${signal} received — shutting down…`)
  engine.dispose()
  io.close()
  httpServer.close()
  await db.$disconnect().catch(() => undefined)
  process.exit(0)
}
process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))
