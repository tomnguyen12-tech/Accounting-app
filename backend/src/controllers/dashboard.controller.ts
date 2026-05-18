import { Request, Response } from "express";
import dayjs from "dayjs";
import { prisma } from "../lib/prisma";
import { CATEGORY_LABELS, Category } from "../services/category/categoryRules";

const monthRange = (month?: string) => {
  const base = month ? dayjs(`${month}-01`) : dayjs();
  return {
    start: base.startOf("month").toDate(),
    end: base.endOf("month").toDate(),
    label: base.format("YYYY.MM"),
    monthNum: base.month() + 1,
  };
};

/** Company-wide summary cards for the main dashboard. */
export async function dashboardSummary(req: Request, res: Response) {
  const { start, end } = monthRange(req.query.month as string | undefined);
  const where = { transactionDate: { gte: start, lte: end } };

  const [agg, count, users, cards, needsReview, missingPurpose, byCategory] =
    await Promise.all([
      prisma.transaction.aggregate({ where, _sum: { amount: true } }),
      prisma.transaction.count({ where }),
      prisma.user.count({ where: { active: true } }),
      prisma.corporateCard.count({ where: { active: true } }),
      prisma.transaction.count({
        where: { ...where, status: { in: ["NEEDS_REVISION", "SUBMITTED"] } },
      }),
      prisma.transaction.count({ where: { ...where, purpose: "" } }),
      prisma.transaction.groupBy({
        by: ["category"],
        where,
        _sum: { amount: true },
        _count: true,
      }),
    ]);

  res.json({
    summary: {
      totalAmount: agg._sum.amount ?? 0,
      totalCount: count,
      userCount: users,
      cardCount: cards,
      needsReview,
      missingPurpose,
    },
    byCategory: byCategory
      .map((c) => ({
        category: c.category ?? "기타",
        label: CATEGORY_LABELS[(c.category ?? "기타") as Category] ?? "Others",
        amount: c._sum.amount ?? 0,
        count: c._count,
      }))
      .sort((a, b) => b.amount - a.amount),
  });
}

/**
 * Individual user monthly dashboard — reproduces the spec example
 * "Kevin 3월 카드 이용내역 요약": summary cards, category pie data,
 * top-5 merchants, largest transaction, daily spending series.
 */
export async function userMonthlyDashboard(req: Request, res: Response) {
  const userId = Number(req.params.userId);
  const { start, end, label, monthNum } = monthRange(req.query.month as string | undefined);
  const where = { userId, transactionDate: { gte: start, lte: end } };

  const [user, agg, count, txns, byCategory] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, department: { select: { name: true } } },
    }),
    prisma.transaction.aggregate({ where, _sum: { amount: true } }),
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      select: {
        amount: true,
        merchantName: true,
        transactionDate: true,
        category: true,
        card: { select: { cardNumberMasked: true } },
      },
    }),
    prisma.transaction.groupBy({
      by: ["category"],
      where,
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  const totalAmount = agg._sum.amount ?? 0;

  const cards = [...new Set(txns.map((t) => t.card?.cardNumberMasked).filter(Boolean))];

  const merchantMap = new Map<string, { amount: number; count: number }>();
  for (const t of txns) {
    const m = merchantMap.get(t.merchantName) ?? { amount: 0, count: 0 };
    m.amount += t.amount;
    m.count += 1;
    merchantMap.set(t.merchantName, m);
  }
  const topMerchants = [...merchantMap.entries()]
    .map(([merchantName, v]) => ({ merchantName, ...v }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  const largest = [...txns].sort((a, b) => b.amount - a.amount)[0] ?? null;

  const dailyMap = new Map<string, number>();
  for (const t of txns) {
    const d = dayjs(t.transactionDate).format("MM-DD");
    dailyMap.set(d, (dailyMap.get(d) ?? 0) + t.amount);
  }
  const daily = [...dailyMap.entries()]
    .map(([date, amount]) => ({ date, amount }))
    .sort((a, b) => a.date.localeCompare(b.date));

  res.json({
    title: `${user?.name ?? "User"} ${monthNum}월 카드 이용내역 요약`,
    subtitle: "월별 지출 현황 및 카테고리 분석",
    summary: {
      totalAmount,
      totalCount: count,
      cards,
      periodStart: dayjs(start).format("YYYY.MM.DD"),
      periodEnd: dayjs(end).format("YYYY.MM.DD"),
      periodLabel: label,
    },
    byCategory: byCategory
      .map((c) => {
        const cat = (c.category ?? "기타") as Category;
        const amount = c._sum.amount ?? 0;
        return {
          category: cat,
          label: CATEGORY_LABELS[cat] ?? "Others",
          amount,
          count: c._count,
          percent: totalAmount ? Number(((amount / totalAmount) * 100).toFixed(1)) : 0,
        };
      })
      .sort((a, b) => b.amount - a.amount),
    topMerchants,
    largest,
    daily,
  });
}
