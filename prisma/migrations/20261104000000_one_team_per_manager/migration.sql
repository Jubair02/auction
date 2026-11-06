-- A manager could end up linked to two teams in one tournament through
-- simultaneous join/invite requests. Fail with an actionable message instead
-- of a bare unique-violation if any such pair already exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Team"
    WHERE "managerUserId" IS NOT NULL
    GROUP BY "tournamentId", "managerUserId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'A manager is linked to more than one team in a tournament. Unlink the extra team(s) first: SELECT "tournamentId", "managerUserId", COUNT(*) FROM "Team" WHERE "managerUserId" IS NOT NULL GROUP BY 1, 2 HAVING COUNT(*) > 1;';
  END IF;
END $$;

-- CreateIndex
CREATE UNIQUE INDEX "Team_tournamentId_managerUserId_key" ON "Team"("tournamentId", "managerUserId");
