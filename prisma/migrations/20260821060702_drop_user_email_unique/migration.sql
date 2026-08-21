-- DropIndex
DROP INDEX "User_email_key";

-- CreateIndex (non-unique — email n'est plus une contrainte d'unicité, voir schema.prisma)
CREATE INDEX "User_email_idx" ON "User"("email");
