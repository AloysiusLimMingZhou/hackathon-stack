// Demo data. Judges see whatever is in the database, so make it look like real usage.
// Run: npm run db:seed   (idempotent: wipes the seeded tables first)
import cli from "./cli-data-source";
import { Item } from "./entities";

async function main() {
  const db = await cli.initialize();
  try {
    // Local dev (DB_SYNC=true): make sure tables exist. Deployed DBs get tables from migrations.
    if (process.env.DB_SYNC === "true") await db.synchronize();
    // TRUNCATE every TypeORM table at once (CASCADE): repository.clear() fails as soon as
    // another table has a foreign key to it. Better Auth's tables are left alone.
    const tables = db.entityMetadatas.map((m) => `"${m.tableName}"`).join(", ");
    await db.query(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`);

    const items = db.getRepository(Item);
    await items.save([
      { title: "First demo item", description: "Shows the happy path" },
      { title: "Second demo item", description: "Shows a list with more than one row" },
    ]);
    console.log(`Seeded ${await items.count()} items`);
  } finally {
    await db.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
