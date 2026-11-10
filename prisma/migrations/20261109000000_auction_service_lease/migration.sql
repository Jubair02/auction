-- Single-instance guard for the live auction service: only the holder of an
-- unexpired lease serves rooms (mini-services/auction-service/lease.ts).

-- CreateTable
CREATE TABLE "ServiceLease" (
    "name" TEXT NOT NULL,
    "holder" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceLease_pkey" PRIMARY KEY ("name")
);
