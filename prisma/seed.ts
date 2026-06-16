import "dotenv/config";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../app/generated/prisma/client";

const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" });
const db = new PrismaClient({ adapter });

async function main() {
  const code = process.env.HOST_INVITE_CODE ?? "letmein";

  await db.hostInviteCode.upsert({
    where: { code },
    update: {},
    create: { code, note: "Default invite code from seed" },
  });

  console.log(`Seed complete. Default invite code: "${code}"`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
