-- Phase 2: per-tournament plans (FREE/PRO) paid by manual bKash/Nagad, optional
-- player registration fees, co-organizer staff, SMS outbox, first-party analytics,
-- self-service account deletion.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "feeBkashNumber" TEXT,
ADD COLUMN     "feeInstructions" TEXT,
ADD COLUMN     "feeNagadNumber" TEXT,
ADD COLUMN     "plan" TEXT NOT NULL DEFAULT 'FREE',
ADD COLUMN     "proSince" TIMESTAMP(3),
ADD COLUMN     "registrationFee" INTEGER,
ADD COLUMN     "resultsPublic" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "smsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "smsLang" TEXT NOT NULL DEFAULT 'bn';

-- AlterTable
ALTER TABLE "PlayerRegistration" ADD COLUMN     "feeAmount" INTEGER,
ADD COLUMN     "payMethod" TEXT,
ADD COLUMN     "paySender" TEXT,
ADD COLUMN     "payStatus" TEXT NOT NULL DEFAULT 'NONE',
ADD COLUMN     "payTrxId" TEXT,
ADD COLUMN     "smsConsent" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'TOURNAMENT_PRO',
    "tournamentId" TEXT,
    "tournamentName" TEXT NOT NULL,
    "userId" TEXT,
    "payerName" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "trxId" TEXT NOT NULL,
    "senderNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentStaff" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "addedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TournamentStaff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'SMS',
    "to" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "tournamentId" TEXT,
    "dedupeKey" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "sendAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT,
    "tournamentId" TEXT,
    "props" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Payment_status_createdAt_idx" ON "Payment"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_tournamentId_idx" ON "Payment"("tournamentId");

-- CreateIndex
CREATE INDEX "Payment_userId_idx" ON "Payment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_method_trxId_key" ON "Payment"("method", "trxId");

-- CreateIndex
CREATE INDEX "TournamentStaff_userId_idx" ON "TournamentStaff"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentStaff_tournamentId_userId_key" ON "TournamentStaff"("tournamentId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");

-- CreateIndex
CREATE INDEX "Notification_status_sendAfter_idx" ON "Notification"("status", "sendAfter");

-- CreateIndex
CREATE INDEX "Notification_tournamentId_idx" ON "Notification"("tournamentId");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_name_createdAt_idx" ON "AnalyticsEvent"("name", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_createdAt_idx" ON "AnalyticsEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerRegistration_payMethod_payTrxId_key" ON "PlayerRegistration"("payMethod", "payTrxId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentStaff" ADD CONSTRAINT "TournamentStaff_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentStaff" ADD CONSTRAINT "TournamentStaff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Grandfather: tournaments created before plans existed keep every feature.
UPDATE "Tournament" SET "plan" = 'PRO', "proSince" = CURRENT_TIMESTAMP WHERE "plan" = 'FREE';
