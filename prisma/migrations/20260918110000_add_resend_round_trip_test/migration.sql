ALTER TABLE "Organization"
ADD COLUMN "roundTripTestToken" TEXT,
ADD COLUMN "roundTripTestAddress" TEXT,
ADD COLUMN "roundTripTestStartedAt" TIMESTAMP(3);
