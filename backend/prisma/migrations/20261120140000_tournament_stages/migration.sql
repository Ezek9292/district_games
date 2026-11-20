-- Football and volleyball as a tournament: group stage, semi-finals, final.
CREATE TYPE "Stage" AS ENUM ('group', 'semi', 'final');

-- AlterTable
ALTER TABLE "Fixture" ADD COLUMN     "groupName" TEXT,
ADD COLUMN     "slot" INTEGER,
ADD COLUMN     "stage" "Stage";
