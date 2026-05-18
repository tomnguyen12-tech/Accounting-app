import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { CATEGORIES, CATEGORY_LABELS } from "../services/category/categoryRules";

export async function listCategoryRules(_req: Request, res: Response) {
  const rules = await prisma.categoryRule.findMany({
    orderBy: [{ priority: "asc" }, { id: "asc" }],
  });
  res.json({
    rules,
    categories: CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] })),
  });
}

const ruleSchema = z.object({
  keyword: z.string().min(1),
  category: z.enum([...CATEGORIES] as [string, ...string[]]),
  priority: z.number().int().default(100),
  active: z.boolean().default(true),
});

export async function createCategoryRule(req: Request, res: Response) {
  const data = ruleSchema.parse(req.body);
  const rule = await prisma.categoryRule.create({ data });
  res.status(201).json({ rule });
}

export async function updateCategoryRule(req: Request, res: Response) {
  const id = Number(req.params.id);
  const data = ruleSchema.partial().parse(req.body);
  const rule = await prisma.categoryRule.update({ where: { id }, data });
  res.json({ rule });
}

export async function deleteCategoryRule(req: Request, res: Response) {
  await prisma.categoryRule.delete({ where: { id: Number(req.params.id) } });
  res.json({ ok: true });
}
