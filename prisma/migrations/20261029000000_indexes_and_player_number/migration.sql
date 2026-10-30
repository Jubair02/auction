-- CreateIndex
CREATE INDEX "Tournament_organizerId_idx" ON "Tournament"("organizerId");

-- CreateIndex
CREATE INDEX "Player_tournamentId_status_idx" ON "Player"("tournamentId", "status");

-- CreateIndex
CREATE INDEX "Player_soldToTeamId_idx" ON "Player"("soldToTeamId");

-- Older concurrent imports could hand out the same player number twice.
-- Fail with an actionable message instead of a bare unique-violation.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Player" GROUP BY "tournamentId", "playerNumber" HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate player numbers exist within a tournament. Renumber them first: SELECT "tournamentId", "playerNumber", COUNT(*) FROM "Player" GROUP BY 1, 2 HAVING COUNT(*) > 1;';
  END IF;
END $$;

-- CreateIndex
CREATE UNIQUE INDEX "Player_tournamentId_playerNumber_key" ON "Player"("tournamentId", "playerNumber");

-- CreateIndex
CREATE INDEX "Team_tournamentId_idx" ON "Team"("tournamentId");

-- CreateIndex
CREATE INDEX "Team_managerUserId_idx" ON "Team"("managerUserId");

-- CreateIndex
CREATE INDEX "Bid_teamId_idx" ON "Bid"("teamId");

