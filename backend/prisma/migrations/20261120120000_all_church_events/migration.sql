-- New sports. Two-church matches: table tennis, draughts.
-- All-church events with placings: 100 m sprint, sack race, lime and spoon, ludo.
ALTER TYPE "GameFormat" ADD VALUE 'tableTennis';
ALTER TYPE "GameFormat" ADD VALUE 'draughts';
ALTER TYPE "GameFormat" ADD VALUE 'sprint';
ALTER TYPE "GameFormat" ADD VALUE 'sackRace';
ALTER TYPE "GameFormat" ADD VALUE 'limeSpoon';
ALTER TYPE "GameFormat" ADD VALUE 'ludo';

-- Points by finishing place for all-church events.
ALTER TABLE "Game" ADD COLUMN     "pointsPlaces" INTEGER[] DEFAULT ARRAY[5, 3, 2, 1]::INTEGER[];

-- All-church events have no church A/B; their churches are in FixtureEntry.
ALTER TABLE "Fixture" ALTER COLUMN "churchAId" DROP NOT NULL,
ALTER COLUMN "churchBId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "FixtureEntry" (
    "fixtureId" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "place" INTEGER,

    CONSTRAINT "FixtureEntry_pkey" PRIMARY KEY ("fixtureId","churchId")
);

-- CreateIndex
CREATE INDEX "FixtureEntry_churchId_idx" ON "FixtureEntry"("churchId");

-- AddForeignKey
ALTER TABLE "FixtureEntry" ADD CONSTRAINT "FixtureEntry_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "Fixture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixtureEntry" ADD CONSTRAINT "FixtureEntry_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;
