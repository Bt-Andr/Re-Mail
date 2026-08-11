-- CreateTable
CREATE TABLE "ExternalMailboxConnection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'imap',
    "email" TEXT NOT NULL,
    "imapHost" TEXT NOT NULL,
    "imapPort" INTEGER NOT NULL DEFAULT 993,
    "imapSecure" BOOLEAN NOT NULL DEFAULT true,
    "smtpHost" TEXT NOT NULL,
    "smtpPort" INTEGER NOT NULL DEFAULT 465,
    "smtpSecure" BOOLEAN NOT NULL DEFAULT true,
    "credentialEnc" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'connected',
    "lastError" TEXT,
    "lastPolledAt" TIMESTAMP(3),
    "lastSeenUid" INTEGER NOT NULL DEFAULT 0,
    "uidValidity" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalMailboxConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExternalMailboxConnection_organizationId_idx" ON "ExternalMailboxConnection"("organizationId");

-- CreateIndex
CREATE INDEX "ExternalMailboxConnection_status_idx" ON "ExternalMailboxConnection"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalMailboxConnection_organizationId_email_key" ON "ExternalMailboxConnection"("organizationId", "email");

-- AddForeignKey
ALTER TABLE "ExternalMailboxConnection" ADD CONSTRAINT "ExternalMailboxConnection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalMailboxConnection" ADD CONSTRAINT "ExternalMailboxConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
