import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { HttpError } from "../lib/http";
import { dedupeKey, parseWorkbook } from "../services/excel/excelParser";
import { NormalizedField } from "../services/excel/columnMap";
import { getAiClassifier, CONFIDENCE_THRESHOLD } from "../services/ai";

/**
 * Step 1 — parse uploaded workbook and return a preview + the auto-detected
 * column mapping. Nothing is persisted yet. If the client posts a `mapping`
 * field (JSON: header → normalized field) the file is re-parsed with that
 * override, so manual remapping works when auto-detection fails.
 */
export async function previewExcel(req: Request, res: Response) {
  if (!req.file) throw new HttpError(400, "No file uploaded");
  let override: Record<string, NormalizedField | null> | undefined;
  if (typeof req.body?.mapping === "string" && req.body.mapping.trim()) {
    try {
      override = JSON.parse(req.body.mapping);
    } catch {
      throw new HttpError(400, "Invalid mapping JSON");
    }
  }
  const result = parseWorkbook(req.file.buffer, override);

  const valid = result.rows.filter((r) => r.errors.length === 0);
  const existing = await prisma.transaction.findMany({
    where: {
      OR: valid.map((r) => ({
        cardNumberMasked: r.cardNumberMasked,
        approvalNumber: r.approvalNumber,
        amount: r.amount,
        transactionDate: r.transactionDate ? new Date(r.transactionDate) : undefined,
      })),
    },
    select: {
      cardNumberMasked: true,
      approvalNumber: true,
      amount: true,
      transactionDate: true,
    },
  });
  const existingKeys = new Set(
    existing.map((e) =>
      dedupeKey({
        cardNumberMasked: e.cardNumberMasked,
        approvalNumber: e.approvalNumber,
        amount: e.amount,
        transactionDate: e.transactionDate.toISOString().slice(0, 10),
      }),
    ),
  );

  res.json({
    headers: result.headers,
    autoMapping: result.autoMapping,
    rows: result.rows.map((r) => ({
      ...r,
      duplicate: r.errors.length === 0 && existingKeys.has(dedupeKey(r)),
    })),
    summary: {
      total: result.rows.length,
      valid: valid.length,
      invalid: result.rows.length - valid.length,
      duplicates: existingKeys.size,
    },
  });
}

const commitSchema = z.object({
  fileName: z.string(),
  cardId: z.number().int().optional(),
  userId: z.number().int().optional(),
  mapping: z.record(z.string(), z.string().nullable()),
  rows: z.array(z.any()),
});

/**
 * Step 2 — persist confirmed rows. Skips duplicates (card + approval# +
 * amount + date), runs the AI classifier for a suggested category, and
 * flags low-confidence rows as NEEDS_REVISION.
 */
export async function commitExcel(req: Request, res: Response) {
  const body = commitSchema.parse(req.body);
  const ai = getAiClassifier();

  const card = body.cardId
    ? await prisma.corporateCard.findUnique({ where: { id: body.cardId } })
    : null;

  const job = await prisma.importJob.create({
    data: {
      type: "EXCEL",
      originalName: body.fileName,
      status: "PARSED",
      createdById: req.user!.id,
      totalRows: body.rows.length,
    },
  });

  let imported = 0;
  let duplicates = 0;
  let errors = 0;
  const log: string[] = [];

  for (const row of body.rows as any[]) {
    if (row.errors?.length) {
      errors++;
      log.push(`Row ${row.rowIndex}: skipped (${row.errors.join(", ")})`);
      continue;
    }
    const exists = await prisma.transaction.findFirst({
      where: {
        cardNumberMasked: row.cardNumberMasked,
        approvalNumber: row.approvalNumber ?? null,
        amount: row.amount,
        transactionDate: new Date(row.transactionDate),
      },
    });
    if (exists) {
      duplicates++;
      log.push(`Row ${row.rowIndex}: duplicate skipped`);
      continue;
    }

    const ace = await ai.classify({
      merchantName: row.merchantName,
      amount: row.amount,
      transactionDate: row.transactionDate,
    });
    const status =
      ace.confidenceScore < CONFIDENCE_THRESHOLD ? "NEEDS_REVISION" : "AI_EXTRACTED";

    await prisma.transaction.create({
      data: {
        userId: body.userId ?? card?.holderUserId ?? null,
        departmentId: card?.departmentId ?? null,
        cardId: card?.id ?? null,
        transactionDate: new Date(row.transactionDate),
        approvalDate: row.approvalDate ? new Date(row.approvalDate) : null,
        paymentDate: row.paymentDate ? new Date(row.paymentDate) : null,
        cardNumberMasked: row.cardNumberMasked,
        approvalNumber: row.approvalNumber ?? null,
        merchantName: row.merchantName,
        merchantNumber: row.merchantNumber ?? null,
        amount: row.amount,
        vatAmount: row.vatAmount ?? 0,
        discountAmount: row.discountAmount ?? 0,
        exchangeFee: row.exchangeFee ?? 0,
        cancelStatus: row.cancelStatus ?? null,
        transactionType: row.transactionType ?? null,
        salesType: row.salesType ?? null,
        category: ace.category,
        purpose: "",
        memo: "",
        sourceType: "EXCEL",
        importJobId: job.id,
        confidenceScore: ace.confidenceScore,
        status,
      },
    });
    imported++;
  }

  await prisma.importJob.update({
    where: { id: job.id },
    data: {
      status: "COMPLETED",
      importedRows: imported,
      duplicateRows: duplicates,
      errorRows: errors,
      log: log as unknown as object,
    },
  });

  res.json({ jobId: job.id, imported, duplicates, errors, log });
}

export async function listImportJobs(_req: Request, res: Response) {
  const jobs = await prisma.importJob.findMany({
    include: { createdBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json({ jobs });
}

// Re-export so the router can validate the mapping type at the edge.
export type { NormalizedField };
