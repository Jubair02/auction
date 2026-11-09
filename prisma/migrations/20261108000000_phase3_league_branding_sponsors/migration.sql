-- Phase 3: league fixtures/results/player stats, tournament branding (Pro) and sponsors.

-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "brandColor" TEXT,
ADD COLUMN     "brandHidePlatform" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "leagueFormat" TEXT,
ADD COLUMN     "oversPerInnings" INTEGER,
ADD COLUMN     "pointsDraw" INTEGER,
ADD COLUMN     "pointsLoss" INTEGER,
ADD COLUMN     "pointsWin" INTEGER;

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "groupName" TEXT;

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'LEAGUE',
    "groupName" TEXT,
    "round" INTEGER NOT NULL DEFAULT 1,
    "matchNumber" INTEGER NOT NULL,
    "homeTeamId" TEXT,
    "awayTeamId" TEXT,
    "homeLabel" TEXT,
    "awayLabel" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "venue" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "homeWickets" INTEGER,
    "awayWickets" INTEGER,
    "homeBalls" INTEGER,
    "awayBalls" INTEGER,
    "winnerTeamId" TEXT,
    "resultType" TEXT,
    "resultNote" TEXT,
    "playerOfMatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchPlayerStat" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "teamId" TEXT,
    "runs" INTEGER,
    "ballsFaced" INTEGER,
    "fours" INTEGER,
    "sixes" INTEGER,
    "wickets" INTEGER,
    "ballsBowled" INTEGER,
    "runsConceded" INTEGER,
    "catches" INTEGER,
    "goals" INTEGER,
    "assists" INTEGER,
    "yellowCards" INTEGER,
    "redCards" INTEGER,
    "saves" INTEGER,
    "points" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchPlayerStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sponsor" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "url" TEXT,
    "tier" TEXT NOT NULL DEFAULT 'SPONSOR',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sponsor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Match_tournamentId_scheduledAt_idx" ON "Match"("tournamentId", "scheduledAt");

-- CreateIndex
CREATE INDEX "Match_homeTeamId_idx" ON "Match"("homeTeamId");

-- CreateIndex
CREATE INDEX "Match_awayTeamId_idx" ON "Match"("awayTeamId");

-- CreateIndex
CREATE UNIQUE INDEX "Match_tournamentId_matchNumber_key" ON "Match"("tournamentId", "matchNumber");

-- CreateIndex
CREATE INDEX "MatchPlayerStat_playerId_idx" ON "MatchPlayerStat"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchPlayerStat_matchId_playerId_key" ON "MatchPlayerStat"("matchId", "playerId");

-- CreateIndex
CREATE INDEX "Sponsor_tournamentId_sortOrder_idx" ON "Sponsor"("tournamentId", "sortOrder");

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchPlayerStat" ADD CONSTRAINT "MatchPlayerStat_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchPlayerStat" ADD CONSTRAINT "MatchPlayerStat_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sponsor" ADD CONSTRAINT "Sponsor_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

