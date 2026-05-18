import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { maskCardNumber } from "../utils/mask";

const cardSelect = {
  id: true,
  cardNumberMasked: true,
  last4: true,
  issuer: true,
  active: true,
  holder: { select: { id: true, name: true } },
  department: { select: { id: true, name: true } },
  _count: { select: { transactions: true } },
} as const;

export async function listCards(_req: Request, res: Response) {
  const cards = await prisma.corporateCard.findMany({
    select: cardSelect,
    orderBy: { id: "asc" },
  });
  res.json({ cards });
}

const createSchema = z.object({
  cardNumber: z.string().min(4),
  issuer: z.string().optional(),
  holderUserId: z.number().int().optional().nullable(),
  departmentId: z.number().int().optional().nullable(),
});

export async function createCard(req: Request, res: Response) {
  const data = createSchema.parse(req.body);
  const { masked, last4 } = maskCardNumber(data.cardNumber);
  const card = await prisma.corporateCard.create({
    data: {
      cardNumberMasked: masked,
      last4,
      issuer: data.issuer,
      holderUserId: data.holderUserId ?? null,
      departmentId: data.departmentId ?? null,
    },
    select: cardSelect,
  });
  res.status(201).json({ card });
}

const updateSchema = z.object({
  issuer: z.string().optional(),
  holderUserId: z.number().int().nullable().optional(),
  departmentId: z.number().int().nullable().optional(),
  active: z.boolean().optional(),
});

export async function updateCard(req: Request, res: Response) {
  const id = Number(req.params.id);
  const data = updateSchema.parse(req.body);
  const card = await prisma.corporateCard.update({
    where: { id },
    data,
    select: cardSelect,
  });
  res.json({ card });
}

export async function deleteCard(req: Request, res: Response) {
  await prisma.corporateCard.update({
    where: { id: Number(req.params.id) },
    data: { active: false },
  });
  res.json({ ok: true });
}
