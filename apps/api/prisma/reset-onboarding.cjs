/**
 * Hand the club to an invited owner and put it back into "not onboarded".
 *
 *   node apps/api/prisma/reset-onboarding.cjs --email owner@example.com [--remove-admin admin@hapoel-bs.demo]
 *
 *  1. removes ZZTEST-* fans (+ subscriptions + their import job) left by wizard test runs
 *  2. deletes the admin given with --remove-admin (the seeded demo admin by default)
 *  3. creates / re-arms the invited owner: Google-invited, plus a temporary password
 *     printed ONLY to this terminal so they can sign in before Google OAuth is configured
 *  4. resets the club: no logo, no symbol, default color, onboardedAt = null
 *
 * Fans and every other table are left untouched (never run the seed for this).
 */
const crypto = require("node:crypto");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const INVITED_EMAIL = (flag("--email", "") || "").toLowerCase().trim();
const REMOVE_ADMIN = (flag("--remove-admin", "admin@hapoel-bs.demo") || "").toLowerCase().trim();
if (!INVITED_EMAIL) {
  console.error("usage: node reset-onboarding.cjs --email owner@example.com [--remove-admin x@y]");
  process.exit(1);
}

const prisma = new PrismaClient();

(async () => {
  const club = await prisma.club.findFirstOrThrow({ orderBy: { createdAt: "asc" } });

  // 1. synthetic rows from wizard test runs
  const testFans = await prisma.fan.findMany({
    where: { clubId: club.id, customerNumber: { startsWith: "ZZTEST-" } },
    select: { id: true },
  });
  const ids = testFans.map((f) => f.id);
  const subs = ids.length ? await prisma.subscription.deleteMany({ where: { fanId: { in: ids } } }) : { count: 0 };
  const fans = ids.length ? await prisma.fan.deleteMany({ where: { id: { in: ids } } }) : { count: 0 };
  const jobs = await prisma.importJob.deleteMany({ where: { clubId: club.id, fileName: "onboarding-fans.csv" } });

  // 2. the admin being replaced (ImportJob / audit rows keep working: FKs are SET NULL)
  const removed =
    REMOVE_ADMIN && REMOVE_ADMIN !== INVITED_EMAIL
      ? await prisma.adminUser.deleteMany({ where: { email: REMOVE_ADMIN } })
      : { count: 0 };

  // 3. invited owner — empty name: Google login or the wizard fills it in
  const tempPassword = crypto.randomBytes(9).toString("base64url");
  const passwordHash = bcrypt.hashSync(tempPassword, 10);
  const owner = await prisma.adminUser.upsert({
    where: { email: INVITED_EMAIL },
    create: { clubId: club.id, email: INVITED_EMAIL, name: "", role: "OWNER", isActive: true, passwordHash },
    update: { role: "OWNER", isActive: true, passwordHash },
    select: { email: true, role: true },
  });

  // 4. club back to a blank slate for the wizard
  const reset = await prisma.club.update({
    where: { id: club.id },
    data: { primaryColor: "#dc2626", logoUrl: null, symbol: null, onboardedAt: null },
    select: { name: true, primaryColor: true, logoUrl: true, symbol: true, onboardedAt: true },
  });

  console.log(
    JSON.stringify(
      {
        removedTestFans: fans.count,
        removedTestSubscriptions: subs.count,
        removedTestImportJobs: jobs.count,
        deletedAdmins: removed.count,
        owner,
        club: reset,
        admins: await prisma.adminUser.findMany({ select: { email: true, role: true, name: true } }),
        totalFans: await prisma.fan.count(),
      },
      null,
      2,
    ),
  );
  console.log(`\nTemporary password for ${INVITED_EMAIL}: ${tempPassword}\n(or sign in with Google once GOOGLE_CLIENT_ID/SECRET are set)`);
  await prisma.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
