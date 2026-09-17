// Seed demo data — run with: bun prisma/seed.ts
import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../src/lib/crypto'

const db = new PrismaClient()

const CRICKET_NAMES = [
  'Shakib Hasan', 'Rahim Ahmed', 'Tamim Chowdhury', 'Mushfiq Karim', 'Mahmudullah Riyad', 'Litton Das',
  'Nurul Hasan', 'Taskin Ahmed', 'Mustafiz Rahman', 'Mehidy Miraz', 'Nayeem Islam', 'Imrul Kayes',
  'Sabbir Rahman', 'Mosaddek Hossain', 'Afif Hossain', 'Shoriful Islam', 'Hasan Mahmud', 'Ebadot Hossain',
  'Nazmul Hossain', 'Towhid Hridoy', 'Jaker Ali', 'Rishad Hossain', 'Tanzid Hasan', 'Tanzim Sakib',
  'Zakir Hasan', 'Mahidul Islam', 'Aliss Al Islam', 'Soumya Sarkar', 'Najmul Shanto', 'Anamul Haque',
  'Farhad Reza', 'Alok Kapali', 'Arafat Sunny', 'Abu Jayed', 'Kamrul Islam', 'Rubel Hossain',
  'Abul Hasan', 'Nasir Hossain', 'Enamul Haque', 'Marshal Ayub',
]

const CRICKER_ROLES_A = ['All-rounder', 'Batsman', 'All-rounder', 'Wicketkeeper', 'All-rounder']
const FOOTBALL_NAMES = [
  'Biplo Bhattacharya', 'Sohel Rana', 'Jamal Bhuyan', 'Mamunul Islam', 'Rakib Hossain', 'Sumon Reza',
  'Fozlu Ahmed', 'Topu Barman', 'Raihan Hasan', 'Mohammad Ibrahim', 'Yeasin Khan', 'Babor Ali',
  'Matin Mia', 'Ridoy Karim', 'Alamin Hossain', 'Emon Babu',
]

function cricketRole(i: number): string {
  const cycle = ['Batsman', 'Bowler', 'All-rounder', 'Bowler', 'Wicketkeeper', 'All-rounder', 'Batsman', 'Bowler']
  return cycle[i % cycle.length]
}

function categoriesFor(i: number): { category: string; basePrice: number } {
  if (i < 8) return { category: 'A', basePrice: 50000 }
  if (i < 18) return { category: 'B', basePrice: 30000 }
  if (i < 28) return { category: 'C', basePrice: 20000 }
  if (i < 36) return { category: 'D', basePrice: 10000 }
  return { category: 'E', basePrice: 5000 }
}

const TEAMS = [
  { name: 'Dhaka Warriors', color: '#0F766E' },
  { name: 'Mirpur Kings', color: '#B45309' },
  { name: 'Uttara Titans', color: '#7C3AED' },
  { name: 'Banani Strikers', color: '#BE123C' },
  { name: 'Gulshan Giants', color: '#1D4ED8' },
  { name: 'Dhanmondi Riders', color: '#15803D' },
  { name: 'Mohammadpur Lions', color: '#B91C1C' },
  { name: 'Motijheel Stars', color: '#A16207' },
]

async function main() {
  console.log('Seeding NeelamGhor demo data…')
  await db.bid.deleteMany()
  await db.roomParticipant.deleteMany()
  await db.auction.deleteMany()
  await db.player.deleteMany()
  await db.team.deleteMany()
  await db.tournament.deleteMany()
  await db.user.deleteMany()

  const pwAdmin = hashPassword('admin1234')
  const pwDemo = hashPassword('demo1234')

  const admin = await db.user.create({
    data: { name: 'Platform Admin', email: 'admin@neelamghor.bd', phone: '01700000000', passwordHash: pwAdmin, role: 'ADMIN' },
  })
  const organizer = await db.user.create({
    data: { name: 'Rafiq Ahmed', email: 'organizer@neelamghor.bd', phone: '01711111111', passwordHash: pwDemo, role: 'ORGANIZER' },
  })
  const manager = await db.user.create({
    data: { name: 'Kamal Uddin', email: 'manager@neelamghor.bd', phone: '01722222222', passwordHash: pwDemo, role: 'MANAGER' },
  })

  // ---- Cricket tournament (CATEGORY mode) ----
  const cricket = await db.tournament.create({
    data: {
      name: 'Mirpur Corporate Cricket League 2026',
      sport: 'CRICKET',
      tournamentType: 'Corporate Cricket',
      description: 'The flagship corporate T20 league of Mirpur. 8 teams battle it out after a live player auction.',
      location: 'Mirpur, Dhaka',
      startDate: new Date('2026-03-01T09:00:00+06:00'),
      auctionAt: new Date('2026-02-20T19:00:00+06:00'),
      auctionMode: 'CATEGORY',
      status: 'READY',
      organizerId: organizer.id,
    },
  })

  for (let i = 0; i < CRICKET_NAMES.length; i++) {
    const cat = categoriesFor(i)
    await db.player.create({
      data: {
        tournamentId: cricket.id,
        name: CRICKET_NAMES[i],
        phone: `018${String(10000000 + i * 137).slice(0, 8)}`,
        role: i < 5 ? CRICKER_ROLES_A[i] : cricketRole(i),
        category: cat.category,
        basePrice: cat.basePrice,
        previousTeam: i % 4 === 0 ? TEAMS[i % TEAMS.length].name : null,
        playerNumber: i + 1,
      },
    })
  }

  for (const [idx, t] of TEAMS.entries()) {
    await db.team.create({
      data: {
        tournamentId: cricket.id,
        name: t.name,
        color: t.color,
        captainName: `Captain of ${t.name}`,
        managerUserId: idx === 0 ? manager.id : null,
        budget: 1000000,
        maxSquad: 10,
        minSquad: 5,
      },
    })
  }

  await db.auction.create({
    data: {
      tournamentId: cricket.id,
      roomCode: 'BD26-DEMO',
      status: 'READY',
      bidTimerSeconds: 20,
      goingIntervalSeconds: 8,
      minIncrement: 5000,
    },
  })

  // ---- Football tournament (NORMAL mode) ----
  const football = await db.tournament.create({
    data: {
      name: 'Dhaka 6-a-side Football Cup 2026',
      sport: 'FOOTBALL',
      tournamentType: '6-a-side / 7-a-side Football',
      description: 'Fast, loud and local. A normal-mode auction — every player starts at ৳10,000.',
      location: 'Dhanmondi, Dhaka',
      startDate: new Date('2026-04-10T16:00:00+06:00'),
      auctionAt: new Date('2026-04-02T20:00:00+06:00'),
      auctionMode: 'NORMAL',
      basePrice: 10000,
      status: 'READY',
      organizerId: organizer.id,
    },
  })

  const fbRoles = ['Goalkeeper', 'Defender', 'Midfielder', 'Forward']
  for (let i = 0; i < FOOTBALL_NAMES.length; i++) {
    await db.player.create({
      data: {
        tournamentId: football.id,
        name: FOOTBALL_NAMES[i],
        role: fbRoles[i % 4],
        basePrice: 10000,
        playerNumber: i + 1,
      },
    })
  }

  const fbTeams = [
    { name: 'Old Dhaka XI', color: '#0E7490' },
    { name: 'Banani FC', color: '#6D28D9' },
    { name: 'Mirpur FC', color: '#15803D' },
    { name: 'Uttara United', color: '#B45309' },
  ]
  for (const t of fbTeams) {
    await db.team.create({
      data: {
        tournamentId: football.id,
        name: t.name,
        color: t.color,
        budget: 200000,
        maxSquad: 8,
        minSquad: 6,
      },
    })
  }

  await db.auction.create({
    data: {
      tournamentId: football.id,
      roomCode: 'BD26-FB01',
      status: 'READY',
      bidTimerSeconds: 15,
      goingIntervalSeconds: 6,
      minIncrement: 5000,
    },
  })

  await db.setting.deleteMany()
  await db.setting.createMany({
    data: [
      { key: 'siteName', value: 'NeelamGhor' },
      { key: 'supportPhone', value: '01700-000000' },
      { key: 'announcement', value: 'Welcome to NeelamGhor — Bangladesh\u2019s live player auction platform.' },
    ],
  })

  console.log('Seed complete.')
  console.log('  admin@neelamghor.bd / admin1234  (ADMIN id:', admin.id + ')')
  console.log('  organizer@neelamghor.bd / demo1234 (ORGANIZER)')
  console.log('  manager@neelamghor.bd / demo1234 (MANAGER — manager of Dhaka Warriors)')
  console.log('  Rooms: BD26-DEMO (cricket), BD26-FB01 (football)')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
