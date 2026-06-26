export default async function globalTeardown() {
  const { db } = await import("../../lib/db");

  // Remove only E2E-specific data by slug/email prefix
  await db.event.deleteMany({ where: { slug: { startsWith: "e2e-" } } });
  await db.user.deleteMany({ where: { email: { endsWith: "@test.internal" } } });
}
