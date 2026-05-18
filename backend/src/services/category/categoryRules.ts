import { prisma } from "../../lib/prisma";

export const CATEGORIES = [
  "식음료",
  "교통",
  "숙박/여행",
  "레저",
  "소프트웨어",
  "사무용품",
  "접대비",
  "기타",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  식음료: "Food & Beverage",
  교통: "Transportation",
  "숙박/여행": "Accommodation & Travel",
  레저: "Leisure",
  소프트웨어: "Software",
  사무용품: "Office Supplies",
  접대비: "Client Entertainment",
  기타: "Others",
};

/** Default keyword → category seed rules (also stored in category_rules table). */
export const DEFAULT_RULES: { keyword: string; category: Category; priority: number }[] = [
  ...["티머니", "택시", "주차장", "주차", "렌트카", "주유소", "주유", "고속도로", "버스", "지하철", "카카오택시"].map(
    (keyword) => ({ keyword, category: "교통" as Category, priority: 10 }),
  ),
  ...["커피", "카페", "스타벅스", "투썸", "커피빈", "식당", "치킨", "횟집", "비어", "맥주", "김밥", "분식", "베이커리", "이디야"].map(
    (keyword) => ({ keyword, category: "식음료" as Category, priority: 10 }),
  ),
  ...["호텔", "숙박", "제주", "리조트", "여행", "항공", "펜션", "게스트하우스"].map((keyword) => ({
    keyword,
    category: "숙박/여행" as Category,
    priority: 10,
  })),
  ...["AWS", "Google", "Microsoft", "Naver Cloud", "네이버클라우드", "Adobe", "Notion", "Slack", "Figma", "GitHub"].map(
    (keyword) => ({ keyword, category: "소프트웨어" as Category, priority: 10 }),
  ),
  ...["문구", "사무용품", "모니터", "키보드", "마우스", "다이소", "오피스디포"].map((keyword) => ({
    keyword,
    category: "사무용품" as Category,
    priority: 10,
  })),
  ...["CGV", "메가박스", "골프", "스크린", "노래방", "볼링", "PC방"].map((keyword) => ({
    keyword,
    category: "레저" as Category,
    priority: 20,
  })),
];

/**
 * Rule-based classifier. Loads active rules from DB (falls back to defaults),
 * matches the highest-priority keyword contained in the merchant name.
 * Returns { category, confidence } so callers can flag low-confidence rows.
 */
export async function classifyMerchant(
  merchantName: string,
): Promise<{ category: Category; confidence: number }> {
  const name = (merchantName ?? "").toLowerCase();
  let rules = await prisma.categoryRule.findMany({
    where: { active: true },
    orderBy: { priority: "asc" },
  });
  if (rules.length === 0) {
    rules = DEFAULT_RULES.map((r, i) => ({
      id: i,
      keyword: r.keyword,
      category: r.category,
      priority: r.priority,
      active: true,
      createdAt: new Date(),
    }));
  }

  for (const rule of rules) {
    if (name.includes(rule.keyword.toLowerCase())) {
      return { category: rule.category as Category, confidence: 0.92 };
    }
  }
  return { category: "기타", confidence: 0.4 };
}
