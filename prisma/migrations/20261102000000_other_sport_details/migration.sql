-- "Others" tournaments: the game's name, its player roles and team sizes.
-- All optional / defaulted, so existing rows are unaffected.
ALTER TABLE "Tournament" ADD COLUMN     "sportName" TEXT,
ADD COLUMN     "playerRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "playersPerTeam" INTEGER,
ADD COLUMN     "playersOnField" INTEGER;
