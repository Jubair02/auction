-- Archive instead of delete: a tournament whose auction has bids or audit
-- events is marked archived, keeping Bid / AuctionEvent rows (which cascade
-- from Auction) intact. Nullable, so existing rows are unaffected.
ALTER TABLE "Tournament" ADD COLUMN     "archivedAt" TIMESTAMP(3);
