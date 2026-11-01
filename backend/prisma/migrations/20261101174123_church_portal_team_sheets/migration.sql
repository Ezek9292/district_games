-- CreateEnum
CREATE TYPE "GameFormat" AS ENUM ('football', 'volleyball', 'penalties');

-- CreateEnum
CREATE TYPE "Division" AS ENUM ('men', 'women', 'open');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('male', 'female');

-- CreateEnum
CREATE TYPE "SheetRole" AS ENUM ('starter', 'sub');

-- DropForeignKey
ALTER TABLE "Player" DROP CONSTRAINT "Player_headshotId_fkey";

-- DropIndex
DROP INDEX "Player_headshotId_key";

-- AlterTable
ALTER TABLE "Church" ADD COLUMN     "email" TEXT,
ADD COLUMN     "lastLoginAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Fixture" ADD COLUMN     "scoreA" INTEGER,
ADD COLUMN     "scoreB" INTEGER;

-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "division" "Division" NOT NULL DEFAULT 'open',
ADD COLUMN     "eldersOnly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "format" "GameFormat" NOT NULL DEFAULT 'football',
ADD COLUMN     "pointsDraw" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "pointsLoss" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pointsWin" INTEGER NOT NULL DEFAULT 3;

-- AlterTable
ALTER TABLE "Player" DROP COLUMN "headshotId",
ADD COLUMN     "gender" "Gender" NOT NULL,
ADD COLUMN     "isElder" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "photoPublicId" TEXT,
ADD COLUMN     "photoUrl" TEXT;

-- DropTable
DROP TABLE "Headshot";

-- CreateTable
CREATE TABLE "TeamSheet" (
    "id" TEXT NOT NULL,
    "fixtureId" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamSheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamSheetPlayer" (
    "sheetId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "role" "SheetRole" NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TeamSheetPlayer_pkey" PRIMARY KEY ("sheetId","playerId")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeamSheet_fixtureId_churchId_key" ON "TeamSheet"("fixtureId", "churchId");

-- CreateIndex
CREATE UNIQUE INDEX "Church_email_key" ON "Church"("email");

-- AddForeignKey
ALTER TABLE "TeamSheet" ADD CONSTRAINT "TeamSheet_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "Fixture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamSheet" ADD CONSTRAINT "TeamSheet_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamSheetPlayer" ADD CONSTRAINT "TeamSheetPlayer_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "TeamSheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamSheetPlayer" ADD CONSTRAINT "TeamSheetPlayer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

