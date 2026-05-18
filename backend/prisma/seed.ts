import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { DEFAULT_RULES } from "../src/services/category/categoryRules";

const prisma = new PrismaClient();

/**
 * Splits `total` into `n` integer parts that look organic but sum exactly to
 * `total` (last part absorbs the rounding remainder). Deterministic so the
 * dashboard always matches the spec example.
 */
function splitAmount(total: number, n: number): number[] {
  const base = Math.floor(total / n / 100) * 100;
  const parts: number[] = [];
  let running = 0;
  for (let i = 0; i < n - 1; i++) {
    const wobble = ((i % 5) - 2) * 5000; // -10000..+10000 in 5k steps
    const v = Math.max(5000, base + wobble);
    parts.push(v);
    running += v;
  }
  parts.push(total - running);
  return parts;
}

const MERCHANTS: Record<string, string[]> = {
  식음료: [
    "텀블러비어역삼직영점",
    "스타벅스역삼점",
    "투썸플레이스강남",
    "커피빈선릉",
    "교촌치킨역삼",
    "노량진수산횟집",
    "김밥천국",
    "이디야커피",
  ],
  "숙박/여행": ["제주신라호텔", "롯데호텔서울", "한화리조트제주"],
  레저: ["CGV강남", "골프존역삼", "스크린골프selfish"],
  교통: ["카카오택시", "티머니교통", "GS칼텍스주유소", "강남공영주차장"],
  기타: ["다이소역삼점", "무인양품"],
};

const CATEGORY_PLAN: { category: string; total: number; count: number }[] = [
  { category: "식음료", total: 2_916_250, count: 22 },
  { category: "숙박/여행", total: 1_585_000, count: 6 },
  { category: "레저", total: 1_074_000, count: 8 },
  { category: "교통", total: 440_900, count: 11 },
  { category: "기타", total: 42_000, count: 2 },
];

async function main() {
  console.log("Seeding…");
  await prisma.reviewLog.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.importJob.deleteMany();
  await prisma.receiptFile.deleteMany();
  await prisma.corporateCard.deleteMany();
  await prisma.categoryRule.deleteMany();
  await prisma.user.deleteMany();
  await prisma.department.deleteMany();

  const sales = await prisma.department.create({ data: { name: "Sales" } });
  const eng = await prisma.department.create({ data: { name: "Engineering" } });
  await prisma.department.create({ data: { name: "Marketing" } });

  const admin = await prisma.user.create({
    data: {
      email: "admin@demo.io",
      name: "Admin",
      role: "ADMIN",
      passwordHash: await bcrypt.hash("admin123", 10),
    },
  });
  await prisma.user.create({
    data: {
      email: "acct@demo.io",
      name: "Accountant",
      role: "ACCOUNTANT",
      passwordHash: await bcrypt.hash("acct123", 10),
    },
  });
  const kevin = await prisma.user.create({
    data: {
      email: "kevin@demo.io",
      name: "Kevin",
      role: "USER",
      departmentId: sales.id,
      passwordHash: await bcrypt.hash("kevin123", 10),
    },
  });
  await prisma.user.create({
    data: {
      email: "sora@demo.io",
      name: "Sora",
      role: "USER",
      departmentId: eng.id,
      passwordHash: await bcrypt.hash("sora123", 10),
    },
  });

  const kevinCard = await prisma.corporateCard.create({
    data: {
      cardNumberMasked: "4835-****-****-7498",
      last4: "7498",
      issuer: "Shinhan Card",
      holderUserId: kevin.id,
      departmentId: sales.id,
    },
  });
  await prisma.corporateCard.create({
    data: {
      cardNumberMasked: "5210-****-****-1043",
      last4: "1043",
      issuer: "Hyundai Card",
      departmentId: eng.id,
    },
  });

  await prisma.categoryRule.createMany({
    data: DEFAULT_RULES.map((r) => ({
      keyword: r.keyword,
      category: r.category,
      priority: r.priority,
      active: true,
    })),
  });

  // Kevin's March 2026 statement — totals/counts match the spec example.
  let dayCursor = 1;
  let created = 0;
  for (const plan of CATEGORY_PLAN) {
    const amounts = splitAmount(plan.total, plan.count);
    const merchants = MERCHANTS[plan.category];
    for (let i = 0; i < amounts.length; i++) {
      const amount = amounts[i];
      const day = ((dayCursor++ * 3) % 31) + 1;
      const date = new Date(Date.UTC(2026, 2, Math.min(day, 31)));
      const vat = Math.round(amount / 11);
      const merchant = merchants[i % merchants.length];
      const status = created % 9 === 0 ? "NEEDS_REVISION" : "AI_EXTRACTED";

      await prisma.transaction.create({
        data: {
          userId: kevin.id,
          departmentId: sales.id,
          cardId: kevinCard.id,
          transactionDate: date,
          approvalDate: new Date(date.getTime() + 86_400_000),
          paymentDate: new Date(Date.UTC(2026, 3, 15)),
          cardNumberMasked: kevinCard.cardNumberMasked,
          approvalNumber: String(30_000_000 + created * 137 + 19),
          merchantName: merchant,
          merchantNumber: String(94_586_000 + created),
          amount,
          vatAmount: vat,
          category: plan.category,
          purpose: "",
          memo: "",
          sourceType: "EXCEL",
          confidenceScore: status === "NEEDS_REVISION" ? 0.55 : 0.92,
          status,
        },
      });
      created++;
    }
  }

  const total = await prisma.transaction.aggregate({
    where: { userId: kevin.id },
    _sum: { amount: true },
    _count: true,
  });
  console.log(
    `Seed complete — Kevin: ${total._count} txns, total ${total._sum.amount?.toLocaleString()}원`,
  );
  console.log(`Logins → admin@demo.io/admin123 · acct@demo.io/acct123 · kevin@demo.io/kevin123`);
  void admin;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
