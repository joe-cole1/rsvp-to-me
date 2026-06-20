import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma");
const postgresSchemaPath = path.join(process.cwd(), "prisma", "schema.postgres.prisma");

async function main() {
  console.log("[generate-postgres-schema] Reading schema.prisma...");
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema file not found at ${schemaPath}`);
  }

  let content = fs.readFileSync(schemaPath, "utf8");

  // Replace provider in generator client
  // Modify generator client output directory to generated/prisma-postgres
  content = content.replace(
    /generator client \{[\s\S]*?\}/,
    `generator client {
  provider = "prisma-client"
  output   = "../app/generated/prisma-postgres"
}`
  );

  // Replace provider in datasource
  content = content.replace(
    /datasource db \{[\s\S]*?\}/,
    `datasource db {
  provider = "postgresql"
}`
  );

  console.log("[generate-postgres-schema] Generating schema.postgres.prisma...");
  fs.writeFileSync(postgresSchemaPath, content, "utf8");

  console.log("[generate-postgres-schema] Running prisma generate for PostgreSQL...");
  try {
    execSync("npx prisma generate --schema=prisma/schema.postgres.prisma", {
      stdio: "inherit",
    });
    console.log("[generate-postgres-schema] PostgreSQL Prisma client generated successfully.");
  } catch (error) {
    console.error("[generate-postgres-schema] Failed to generate PostgreSQL client:", error);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
