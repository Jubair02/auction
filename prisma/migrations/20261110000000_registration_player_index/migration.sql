-- The SMS worker looks registrations up by player (consent check) on every sale.
CREATE INDEX "PlayerRegistration_playerId_idx" ON "PlayerRegistration"("playerId");
