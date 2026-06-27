import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const KERALA_DISTRICTS = [
  { name: 'Thiruvananthapuram', nameMl: 'തിരുവനന്തപുരം' },
  { name: 'Kollam',             nameMl: 'കൊല്ലം' },
  { name: 'Pathanamthitta',     nameMl: 'പത്തനംതിട്ട' },
  { name: 'Alappuzha',          nameMl: 'ആലപ്പുഴ' },
  { name: 'Kottayam',           nameMl: 'കോട്ടയം' },
  { name: 'Idukki',             nameMl: 'ഇടുക്കി' },
  { name: 'Ernakulam',          nameMl: 'എറണാകുളം' },
  { name: 'Thrissur',           nameMl: 'തൃശ്ശൂർ' },
  { name: 'Palakkad',           nameMl: 'പാലക്കാട്' },
  { name: 'Malappuram',         nameMl: 'മലപ്പുറം' },
  { name: 'Kozhikode',          nameMl: 'കോഴിക്കോട്' },
  { name: 'Wayanad',            nameMl: 'വയനാട്' },
  { name: 'Kannur',             nameMl: 'കണ്ണൂർ' },
  { name: 'Kasaragod',          nameMl: 'കാസർഗോഡ്' },
];

async function main() {
  console.log('🌱 Seeding adkerala database...');

  // ── Districts ──────────────────────────────────────────────────────────
  for (const d of KERALA_DISTRICTS) {
    await prisma.district.upsert({
      where: { name: d.name },
      update: { nameMl: d.nameMl },
      create: d,
    });
  }
  console.log(`✅ ${KERALA_DISTRICTS.length} districts seeded`);

  // ── Revenue config singleton ───────────────────────────────────────────
  await prisma.revenueConfig.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
      defaultAdvertiserCpm: 20,
      defaultOwnerCpm: 12,
    },
  });
  console.log('✅ Revenue config seeded (advertiserCpm=20, ownerCpm=12)');

  // ── Platform admin account ─────────────────────────────────────────────
  const adminOrg = await prisma.organization.upsert({
    where: { slug: 'adkerala' },
    update: {},
    create: {
      name: 'adkerala',
      nameMl: 'ആഡ്‌കേരള',
      slug: 'adkerala',
    },
  });

  const adminPassword = await bcrypt.hash('admin123', 12);
  await prisma.user.upsert({
    where: { email: 'admin@adkerala.in' },
    update: {},
    create: {
      orgId: adminOrg.id,
      email: 'admin@adkerala.in',
      name: 'Platform Admin',
      role: 'platform_admin',
      password: adminPassword,
    },
  });
  console.log('✅ Platform admin seeded: admin@adkerala.in / admin123');
  console.log('⚠️  CHANGE the admin password in production!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
