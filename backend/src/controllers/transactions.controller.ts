import { Request, Response } from "express";
import { Prisma, SourceType, TransactionStatus } from "@prisma/client";
import { z } from "zod";
import dayjs from "dayjs";
import { prisma } from "../lib/prisma";
import { HttpError } from "../lib/http";

/**
 * Build a Prisma `where` from the full filter set required by the spec:
 * month, date range, user, department, card, category, merchant, amount
 * range, status, source type, missing purpose, missing receipt, approval.
 */
function buildWhere(q: Record<string, unknown>): Prisma.TransactionWhereInput {
  const where: Prisma.TransactionWhereInput = {};
  const s = (k: string) => (q[k] != null && q[k] !== "" ? String(q[k]) : undefined);

  // Month "YYYY-MM" or explicit from/to date range.
  const month = s("month");
  const from = s("from");
  const to = s("to");
  if (month) {
    const start = dayjs(`${month}-01`).startOf("month").toDate();
    const end = dayjs(`${month}-01`).endOf("month").toDate();
    where.transactionDate = { gte: start, lte: end };
  } else if (from || to) {
    where.transactionDate = {
      ...(from ? { gte: dayjs(from).startOf("day").toDate() } : {}),
      ...(to ? { lte: dayjs(to).endOf("day").toDate() } : {}),
    };
  }

  if (s("userId")) where.userId = Number(q.userId);
  if (s("departmentId")) where.departmentId = Number(q.departmentId);
  if (s("cardId")) where.cardId = Number(q.cardId);
  if (s("category")) where.category = String(q.category);
  if (s("status")) where.status = String(q.status) as TransactionStatus;
  if (s("sourceType")) where.sourceType = String(q.sourceType) as SourceType;
  if (s("merchant"))
    where.merchantName = { contains: String(q.merchant), mode: "insensitive" };

  const min = s("minAmount");
  const max = s("maxAmount");
  if (min || max) {
    where.amount = {
      ...(min ? { gte: Number(min) } : {}),
      ...(max ? { lte: Number(max) } : {}),
    };
  }

  if (s("missingPurpose") === "true") where.purpose = "";
  if (s("missingReceipt") === "true") where.sourceFileId = null;
  if (s("approved") === "true") where.status = "APPROVED";
  if (s("approved") === "false") where.status = { not: "APPROVED" };

  return where;
}

export async function listTransactions(req: Request, res: Response) {
  const q = req.query as Record<string, unknown>;
  const page = Math.max(1, Number(q.page ?? 1));
  const pageSize = Math.min(200, Math.max(1, Number(q.pageSize ?? 25)));
  const where = buildWhere(q);

  const sortField = ["transactionDate", "amount", "merchantName", "status"].includes(
    String(q.sortBy),
  )
    ? String(q.sortBy)
    : "transactionDate";
  const sortDir = String(q.sortDir) === "asc" ? "asc" : "desc";

  const [total, rows, sum] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      include: {
        user: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        card: { select: { id: true, cardNumberMasked: true } },
      },
      orderBy: { [sortField]: sortDir },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.transaction.aggregate({ where, _sum: { amount: true } }),
  ]);

  res.json({
    rows,
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
    totalAmount: sum._sum.amount ?? 0,
  });
}

export async function getTransaction(req: Request, res: Response) {
  const tx = await prisma.transaction.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      user: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
      card: { select: { id: true, cardNumberMasked: true } },
      sourceFile: true,
      reviewLogs: {
        include: { reviewer: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!tx) throw new HttpError(404, "Transaction not found");
  res.json({ transaction: tx });
}

// Business rule: AI suggests category; the spender must enter purpose/memo.
const editSchema = z.object({
  purpose: z.string().optional(),
  memo: z.string().optional(),
  category: z.string().optional(),
});

export async function updateTransaction(req: Request, res: Response) {
  const id = Number(req.params.id);
  const data = editSchema.parse(req.body);
  const current = await prisma.transaction.findUnique({ where: { id } });
  if (!current) throw new HttpError(404, "Transaction not found");

  const tx = await prisma.transaction.update({
    where: { id },
    data: {
      purpose: data.purpose ?? current.purpose,
      memo: data.memo ?? current.memo,
      category: data.category ?? current.category,
    },
  });
  await prisma.reviewLog.create({
    data: {
      transactionId: id,
      action: "EDIT",
      fromStatus: current.status,
      toStatus: tx.status,
      reviewerId: req.user!.id,
      comment: "Edited purpose/memo/category",
    },
  });
  res.json({ transaction: tx });
}

const STATUS_TRANSITIONS: Record<string, TransactionStatus> = {
  SUBMIT: "SUBMITTED",
  APPROVE: "APPROVED",
  REJECT: "REJECTED",
  REQUEST_REVISION: "NEEDS_REVISION",
};

const reviewSchema = z.object({
  action: z.enum(["SUBMIT", "APPROVE", "REJECT", "REQUEST_REVISION"]),
  comment: z.string().optional(),
});

export async function reviewTransaction(req: Request, res: Response) {
  const id = Number(req.params.id);
  const { action, comment } = reviewSchema.parse(req.body);
  const current = await prisma.transaction.findUnique({ where: { id } });
  if (!current) throw new HttpError(404, "Transaction not found");

  // Spender must enter a purpose before the transaction can be submitted.
  if (action === "SUBMIT" && !current.purpose.trim()) {
    throw new HttpError(400, "Purpose is required before submitting");
  }

  const toStatus = STATUS_TRANSITIONS[action];
  const tx = await prisma.transaction.update({
    where: { id },
    data: { status: toStatus },
  });
  await prisma.reviewLog.create({
    data: {
      transactionId: id,
      action,
      fromStatus: current.status,
      toStatus,
      comment,
      reviewerId: req.user!.id,
    },
  });
  res.json({ transaction: tx });
}
