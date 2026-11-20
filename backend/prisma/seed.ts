import "dotenv/config";
import { PrismaClient, type Prisma } from "@prisma/client";
import { normalizeLogin } from "../src/lib/login";

const prisma = new PrismaClient();

async function main() {
  await prisma.event.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

  const logins = (process.env.ORGANIZER_EMAILS ?? "")
    .split(",")
    .map((e) => normalizeLogin(e))
    .filter((e): e is string => !!e);
  for (const login of logins) {
    await prisma.organizer.upsert({ where: { login }, update: { isSuper: true }, create: { login, isSuper: true } });
  }

  // The district's games, added once; organizers can edit them afterwards.
  if ((await prisma.game.count()) === 0) {
    await prisma.game.createMany({
      data: [
        { name: "Men's Soccer", format: "football", division: "men" },
        { name: "Women's Soccer", format: "football", division: "women" },
        { name: "Men's Volleyball", format: "volleyball", division: "men", pointsDraw: 0 },
        { name: "Women's Volleyball", format: "volleyball", division: "women", pointsDraw: 0 },
        { name: "Table Tennis", format: "tableTennis", division: "open", pointsDraw: 0 },
        { name: "Draughts", format: "draughts", division: "open" },
        // All-church events: every church competes at once and is ranked.
        { name: "100 Metres", format: "sprint", division: "open" },
        { name: "Sack Race", format: "sackRace", division: "open" },
        { name: "Lime and Spoon", format: "limeSpoon", division: "open" },
        { name: "Ludo", format: "ludo", division: "open" },
      ].map((g, order) => ({ ...g, order } as Prisma.GameCreateManyInput)),
    });
  }
  console.log(`Seeded event, ${logins.length} organizer(s) and games.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
