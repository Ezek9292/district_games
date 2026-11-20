-- Super organizers approve results entered by other organizers.
ALTER TABLE "Organizer" ADD COLUMN     "isSuper" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Fixture" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "enteredById" TEXT;

-- AddForeignKey
ALTER TABLE "Fixture" ADD CONSTRAINT "Fixture_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "Organizer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Results already on the scoreboard stay there: treat them as approved.
UPDATE "Fixture" SET "approvedAt" = CURRENT_TIMESTAMP WHERE "status" = 'final';
