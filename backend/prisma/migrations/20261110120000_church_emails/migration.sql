-- CreateTable
CREATE TABLE "ChurchEmail" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "ChurchEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChurchEmail_email_key" ON "ChurchEmail"("email");

-- CreateIndex
CREATE INDEX "ChurchEmail_churchId_idx" ON "ChurchEmail"("churchId");

-- AddForeignKey
ALTER TABLE "ChurchEmail" ADD CONSTRAINT "ChurchEmail_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Carry over each church's existing rep email.
INSERT INTO "ChurchEmail" ("id", "email", "churchId", "lastLoginAt")
SELECT 'ce_' || md5(random()::text || "id"), "email", "id", "lastLoginAt"
FROM "Church"
WHERE "email" IS NOT NULL;

-- DropIndex
DROP INDEX "Church_email_key";

-- AlterTable
ALTER TABLE "Church" DROP COLUMN "email";
