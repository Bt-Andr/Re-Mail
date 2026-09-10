-- AlterTable
ALTER TABLE "ThreadMessage"
ADD COLUMN "internetMessageId" TEXT,
ADD COLUMN "inReplyTo" TEXT,
ADD COLUMN "references" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "ThreadMessage_organizationId_internetMessageId_idx"
ON "ThreadMessage"("organizationId", "internetMessageId");
