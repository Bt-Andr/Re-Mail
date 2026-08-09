-- AlterTable
ALTER TABLE "Thread" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "starred" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Thread_organizationId_archivedAt_idx" ON "Thread"("organizationId", "archivedAt");
