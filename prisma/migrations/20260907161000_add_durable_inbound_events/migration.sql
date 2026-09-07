-- CreateTable
CREATE TABLE "InboundEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "lockedAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboundEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InboundEvent_organizationId_provider_externalId_key"
ON "InboundEvent"("organizationId", "provider", "externalId");

-- CreateIndex
CREATE INDEX "InboundEvent_status_nextAttemptAt_idx"
ON "InboundEvent"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "InboundEvent_organizationId_idx"
ON "InboundEvent"("organizationId");

-- AddForeignKey
ALTER TABLE "InboundEvent"
ADD CONSTRAINT "InboundEvent_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
