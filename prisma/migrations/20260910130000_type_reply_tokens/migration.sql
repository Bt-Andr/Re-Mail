-- AlterTable
-- Les tokens déjà émis gardent le comportement historique jusqu'à leur expiration.
ALTER TABLE "MailReplyToken"
ADD COLUMN "purpose" TEXT NOT NULL DEFAULT 'legacy';
