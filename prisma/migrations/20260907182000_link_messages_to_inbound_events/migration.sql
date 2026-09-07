-- AlterTable
ALTER TABLE "ThreadMessage" ADD COLUMN "inboundEventId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ThreadMessage_inboundEventId_key"
ON "ThreadMessage"("inboundEventId");
