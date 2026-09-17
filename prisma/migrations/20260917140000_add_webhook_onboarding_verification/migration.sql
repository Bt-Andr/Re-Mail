ALTER TABLE "Organization"
ADD COLUMN "webhookTestToken" TEXT,
ADD COLUMN "webhookTestStartedAt" TIMESTAMP(3),
ADD COLUMN "webhookVerifiedAt" TIMESTAMP(3);
