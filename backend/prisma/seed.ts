import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.event.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

  const emails = (process.env.ORGANIZER_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  for (const email of emails) {
    await prisma.organizer.upsert({ where: { email }, update: {}, create: { email } });
  }

  // The district's games, added once; organizers can edit them afterwards.
  if ((await prisma.game.count()) === 0) {
    await prisma.game.createMany({
      data: [
        { name: "Men's Soccer", format: "football", division: "men" },
        { name: "Women's Soccer", format: "football", division: "women" },
        { name: "Elders' Penalty Shoot-out", format: "penalties", division: "open", eldersOnly: true, pointsDraw: 0 },
        { name: "Men's Volleyball", format: "volleyball", division: "men", pointsDraw: 0 },
        { name: "Women's Volleyball", format: "volleyball", division: "women", pointsDraw: 0 },
      ].map((g, order) => ({ ...g, order })),
    });
  }
  console.log(`Seeded event, ${emails.length} organizer(s) and games.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
