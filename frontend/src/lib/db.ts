import dayjs from "dayjs";
import { supabase } from "./supabase";
import { classify, dedupeKey, ParsedRow } from "./excel";
import type {
  CardRow,
  CategorySlice,
  DashboardSummary,
  Department,
  ImportJob,
  ReportSummary,
  Transaction,
  TransactionPage,
  UserDashboard,
  UserRow,
} from "@/types";

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

export const CATEGORY_LABELS: Record<string, string> = {
  식음료: "Food & Beverage",
  교통: "Transportation",
  "숙박/여행": "Accommodation & Travel",
  레저: "Leisure",
  소프트웨어: "Software",
  사무용품: "Office Supplies",
  접대비: "Client Entertainment",
  기타: "Others",
};

const monthRange = (month?: string) => {
  const base = month ? dayjs(`${month}-01`) : dayjs();
  return {
    start: base.startOf("month").format("YYYY-MM-DD"),
    end: base.endOf("month").format("YYYY-MM-DD"),
    label: base.format("YYYY.MM"),
    monthNum: base.month() + 1,
  };
};

// snake_case row → camelCase Transaction the UI expects.
const mapTx = (r: any): Transaction => ({
  id: r.id,
  transactionDate: r.transaction_date,
  approvalDate: r.approval_date,
  paymentDate: r.payment_date,
  cardNumberMasked: r.card_number_masked,
  approvalNumber: r.approval_number,
  merchantName: r.merchant_name,
  merchantNumber: r.merchant_number,
  amount: Number(r.amount),
  vatAmount: Number(r.vat_amount ?? 0),
  discountAmount: Number(r.discount_amount ?? 0),
  exchangeFee: Number(r.exchange_fee ?? 0),
  category: r.category,
  purpose: r.purpose ?? "",
  memo: r.memo ?? "",
  sourceType: r.source_type,
  confidenceScore: r.confidence_score,
  status: r.status,
  user: r.user ? { id: r.user.id, name: r.user.name } : null,
  department: r.department ? { id: r.department.id, name: r.department.name } : null,
  card: r.card ? { id: r.card.id, cardNumberMasked: r.card.card_number_masked } : null,
  importJob: r.import_job ? { id: r.import_job.id, originalName: r.import_job.original_name } : null,
  reviewLogs: (r.review_logs ?? []).map((l: any) => ({
    id: l.id,
    action: l.action,
    fromStatus: l.from_status,
    toStatus: l.to_status,
    comment: l.comment,
    createdAt: l.created_at,
    reviewer: l.reviewer ? { name: l.reviewer.name } : null,
  })),
});

const TX_SELECT =
  "*, user:users(id,name), department:departments(id,name), card:corporate_cards(id,card_number_masked), import_job:import_jobs(id,original_name)";

export const db = {
  async listDepartments(): Promise<{ departments: Department[] }> {
    const { data, error } = await supabase
      .from("departments")
      .select("id,name")
      .order("name");
    if (error) throw error;
    return { departments: data ?? [] };
  },

  async listUsers(): Promise<{ users: UserRow[] }> {
    const [{ data: users, error }, { data: txs }, { data: cards }] = await Promise.all([
      supabase
        .from("users")
        .select("id,email,name,role,active, department:departments(id,name)")
        .order("created_at"),
      supabase.from("transactions").select("user_id"),
      supabase.from("corporate_cards").select("holder_user_id"),
    ]);
    if (error) throw error;
    const txCount = new Map<string, number>();
    (txs ?? []).forEach((t: any) => t.user_id && txCount.set(t.user_id, (txCount.get(t.user_id) ?? 0) + 1));
    const cardCount = new Map<string, number>();
    (cards ?? []).forEach(
      (c: any) =>
        c.holder_user_id && cardCount.set(c.holder_user_id, (cardCount.get(c.holder_user_id) ?? 0) + 1),
    );
    return {
      users: (users ?? []).map((u: any) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        active: u.active,
        department: u.department,
        _count: {
          transactions: txCount.get(u.id) ?? 0,
          cards: cardCount.get(u.id) ?? 0,
        },
      })),
    };
  },

  async listCards(opts: { userId?: string } = {}): Promise<{ cards: CardRow[] }> {
    let query = supabase
      .from("corporate_cards")
      .select(
        "id,card_number_masked,last4,issuer,active,holder_user_id, holder:users(id,name), department:departments(id,name)",
      )
      .order("id");
    if (opts.userId) query = query.eq("holder_user_id", opts.userId);
    const [{ data, error }, { data: txs }] = await Promise.all([
      query,
      supabase.from("transactions").select("card_id"),
    ]);
    if (error) throw error;
    const cnt = new Map<number, number>();
    (txs ?? []).forEach((t: any) => t.card_id && cnt.set(t.card_id, (cnt.get(t.card_id) ?? 0) + 1));
    return {
      cards: (data ?? []).map((c: any) => ({
        id: c.id,
        cardNumberMasked: c.card_number_masked,
        last4: c.last4,
        issuer: c.issuer,
        active: c.active,
        holder: c.holder,
        department: c.department,
        _count: { transactions: cnt.get(c.id) ?? 0 },
      })),
    };
  },

  async createCard(input: {
    cardNumber: string;
    issuer?: string;
    holderUserId?: string | null;
    departmentId?: number | null;
  }) {
    const digits = input.cardNumber.replace(/[^0-9]/g, "");
    const masked =
      digits.length >= 8
        ? `${digits.slice(0, 4)}-****-****-${digits.slice(-4)}`
        : input.cardNumber;
    const { error } = await supabase.from("corporate_cards").insert({
      card_number_masked: masked,
      last4: digits.slice(-4) || "0000",
      issuer: input.issuer ?? null,
      holder_user_id: input.holderUserId ?? null,
      department_id: input.departmentId ?? null,
    });
    if (error) throw error;
  },

  async updateCard(id: number, patch: { holderUserId?: string | null }) {
    const { error } = await supabase
      .from("corporate_cards")
      .update({ holder_user_id: patch.holderUserId ?? null })
      .eq("id", id);
    if (error) throw error;
  },

  async listTransactions(
    f: Record<string, string | number | undefined>,
  ): Promise<TransactionPage> {
    const page = Math.max(1, Number(f.page ?? 1));
    const pageSize = Math.min(200, Math.max(1, Number(f.pageSize ?? 25)));
    const has = (k: string) => f[k] != null && f[k] !== "";

    const applyFilters = (q: any) => {
      if (has("month")) {
        const { start, end } = monthRange(String(f.month));
        q = q.gte("transaction_date", start).lte("transaction_date", end);
      } else {
        if (has("from")) q = q.gte("transaction_date", String(f.from));
        if (has("to")) q = q.lte("transaction_date", String(f.to));
      }
      if (has("userId")) q = q.eq("user_id", String(f.userId));
      if (has("departmentId")) q = q.eq("department_id", Number(f.departmentId));
      if (has("cardId")) q = q.eq("card_id", Number(f.cardId));
      if (has("category")) q = q.eq("category", String(f.category));
      if (has("status")) q = q.eq("status", String(f.status));
      if (has("sourceType")) q = q.eq("source_type", String(f.sourceType));
      if (has("importJobId")) q = q.eq("import_job_id", Number(f.importJobId));
      if (has("merchant")) q = q.ilike("merchant_name", `%${f.merchant}%`);
      if (has("minAmount")) q = q.gte("amount", Number(f.minAmount));
      if (has("maxAmount")) q = q.lte("amount", Number(f.maxAmount));
      if (f.missingPurpose === "true") q = q.eq("purpose", "");
      if (f.missingReceipt === "true") q = q.is("source_file_id", null);
      if (f.approved === "true") q = q.eq("status", "APPROVED");
      if (f.approved === "false") q = q.neq("status", "APPROVED");
      return q;
    };

    const { data, count, error } = await applyFilters(
      supabase.from("transactions").select(TX_SELECT, { count: "exact" }),
    )
      .order("transaction_date", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);
    if (error) throw error;

    const { data: sumRows } = await applyFilters(
      supabase.from("transactions").select("amount"),
    );
    const totalAmount = (sumRows ?? []).reduce((a: number, r: any) => a + Number(r.amount), 0);

    const total = count ?? 0;
    return {
      rows: (data ?? []).map(mapTx),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize) || 1,
      totalAmount,
    };
  },

  async getTransaction(id: number): Promise<{ transaction: Transaction }> {
    const { data, error } = await supabase
      .from("transactions")
      .select(`${TX_SELECT}, review_logs(*, reviewer:users(name))`)
      .eq("id", id)
      .single();
    if (error) throw error;
    const tx = mapTx(data);
    tx.reviewLogs = (tx.reviewLogs ?? []).sort(
      (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
    );
    return { transaction: tx };
  },

  async updateTransaction(
    id: number,
    patch: { purpose?: string; memo?: string; category?: string },
    reviewerId?: string,
  ) {
    const { data: cur } = await supabase
      .from("transactions")
      .select("status")
      .eq("id", id)
      .single();
    const { error } = await supabase
      .from("transactions")
      .update({ ...snake(patch), updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    await supabase.from("review_logs").insert({
      transaction_id: id,
      action: "EDIT",
      from_status: cur?.status,
      to_status: cur?.status,
      reviewer_id: reviewerId ?? null,
      comment: "Edited purpose/memo/category",
    });
  },

  async reviewTransaction(
    id: number,
    action: "SUBMIT" | "APPROVE" | "REJECT" | "REQUEST_REVISION",
    reviewerId?: string,
    comment?: string,
  ) {
    const map = {
      SUBMIT: "SUBMITTED",
      APPROVE: "APPROVED",
      REJECT: "REJECTED",
      REQUEST_REVISION: "NEEDS_REVISION",
    } as const;
    const { data: cur } = await supabase
      .from("transactions")
      .select("status,purpose")
      .eq("id", id)
      .single();
    if (action === "SUBMIT" && !String(cur?.purpose ?? "").trim())
      throw new Error("Purpose is required before submitting");
    const to = map[action];
    const { error } = await supabase
      .from("transactions")
      .update({ status: to, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    await supabase.from("review_logs").insert({
      transaction_id: id,
      action,
      from_status: cur?.status,
      to_status: to,
      reviewer_id: reviewerId ?? null,
      comment: comment ?? null,
    });
  },

  async dashboardSummary(month?: string): Promise<DashboardSummary> {
    const { start, end } = monthRange(month);
    const [{ data: txs }, { count: userCount }, { count: cardCount }] = await Promise.all([
      supabase
        .from("transactions")
        .select("amount,category,status,purpose")
        .gte("transaction_date", start)
        .lte("transaction_date", end),
      supabase.from("users").select("*", { count: "exact", head: true }).eq("active", true),
      supabase
        .from("corporate_cards")
        .select("*", { count: "exact", head: true })
        .eq("active", true),
    ]);
    const rows = txs ?? [];
    const byCat = new Map<string, { amount: number; count: number }>();
    let totalAmount = 0;
    let needsReview = 0;
    let missingPurpose = 0;
    for (const t of rows as any[]) {
      totalAmount += Number(t.amount);
      const c = t.category ?? "기타";
      const e = byCat.get(c) ?? { amount: 0, count: 0 };
      e.amount += Number(t.amount);
      e.count += 1;
      byCat.set(c, e);
      if (["NEEDS_REVISION", "SUBMITTED"].includes(t.status)) needsReview++;
      if (!String(t.purpose ?? "").trim()) missingPurpose++;
    }
    return {
      summary: {
        totalAmount,
        totalCount: rows.length,
        userCount: userCount ?? 0,
        cardCount: cardCount ?? 0,
        needsReview,
        missingPurpose,
      },
      byCategory: [...byCat.entries()]
        .map(([category, v]) => ({
          category,
          label: CATEGORY_LABELS[category] ?? "Others",
          amount: v.amount,
          count: v.count,
        }))
        .sort((a, b) => b.amount - a.amount),
    };
  },

  async userMonthlyDashboard(userId: string, month?: string): Promise<UserDashboard> {
    const { start, end, label, monthNum } = monthRange(month);
    const [{ data: profile }, { data: txs }] = await Promise.all([
      supabase.from("users").select("name").eq("id", userId).single(),
      supabase
        .from("transactions")
        .select("amount,merchant_name,transaction_date,category, card:corporate_cards(card_number_masked)")
        .eq("user_id", userId)
        .gte("transaction_date", start)
        .lte("transaction_date", end),
    ]);
    const rows = (txs ?? []) as any[];
    const totalAmount = rows.reduce((a, t) => a + Number(t.amount), 0);
    const cards = [...new Set(rows.map((t) => t.card?.card_number_masked).filter(Boolean))];

    const byCat = new Map<string, { amount: number; count: number }>();
    const byMerchant = new Map<string, { amount: number; count: number }>();
    const byDay = new Map<string, number>();
    for (const t of rows) {
      const c = t.category ?? "기타";
      const e = byCat.get(c) ?? { amount: 0, count: 0 };
      e.amount += Number(t.amount);
      e.count++;
      byCat.set(c, e);
      const m = byMerchant.get(t.merchant_name) ?? { amount: 0, count: 0 };
      m.amount += Number(t.amount);
      m.count++;
      byMerchant.set(t.merchant_name, m);
      const d = dayjs(t.transaction_date).format("MM-DD");
      byDay.set(d, (byDay.get(d) ?? 0) + Number(t.amount));
    }
    const largest = [...rows].sort((a, b) => Number(b.amount) - Number(a.amount))[0];

    return {
      title: `${profile?.name ?? "User"} ${monthNum}월 카드 이용내역 요약`,
      subtitle: "월별 지출 현황 및 카테고리 분석",
      summary: {
        totalAmount,
        totalCount: rows.length,
        cards,
        periodStart: dayjs(start).format("YYYY.MM.DD"),
        periodEnd: dayjs(end).format("YYYY.MM.DD"),
        periodLabel: label,
      },
      byCategory: [...byCat.entries()]
        .map(([category, v]) => ({
          category,
          label: CATEGORY_LABELS[category] ?? "Others",
          amount: v.amount,
          count: v.count,
          percent: totalAmount ? Number(((v.amount / totalAmount) * 100).toFixed(1)) : 0,
        }))
        .sort((a, b) => b.amount - a.amount) as CategorySlice[],
      topMerchants: [...byMerchant.entries()]
        .map(([merchantName, v]) => ({ merchantName, ...v }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5),
      largest: largest
        ? {
            merchantName: largest.merchant_name,
            amount: Number(largest.amount),
            transactionDate: largest.transaction_date,
          }
        : null,
      daily: [...byDay.entries()]
        .map(([date, amount]) => ({ date, amount }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    };
  },

  async listCategoryRules() {
    const { data, error } = await supabase
      .from("category_rules")
      .select("*")
      .order("priority")
      .order("id");
    if (error) throw error;
    return {
      rules: data ?? [],
      categories: CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] })),
    };
  },

  async createCategoryRule(input: {
    keyword: string;
    category: string;
    priority: number;
  }) {
    const { error } = await supabase.from("category_rules").insert({ ...input, active: true });
    if (error) throw error;
  },

  async updateCategoryRule(id: number, patch: Record<string, unknown>) {
    const { error } = await supabase.from("category_rules").update(patch).eq("id", id);
    if (error) throw error;
  },

  async deleteCategoryRule(id: number) {
    const { error } = await supabase.from("category_rules").delete().eq("id", id);
    if (error) throw error;
  },

  /** Excel preview: flag rows already in DB (card+approval#+amount+date). */
  async excelDuplicates(rows: ParsedRow[]) {
    const valid = rows.filter((r) => r.errors.length === 0);
    if (!valid.length) return new Set<string>();
    const { data } = await supabase
      .from("transactions")
      .select("card_number_masked,approval_number,amount,transaction_date");
    return new Set(
      (data ?? []).map((e: any) =>
        dedupeKey({
          cardNumberMasked: e.card_number_masked,
          approvalNumber: e.approval_number,
          amount: Number(e.amount),
          transactionDate: e.transaction_date,
        }),
      ),
    );
  },

  async commitExcel(input: {
    fileName: string;
    userId: string;                  // required (req #1)
    cardId?: number | null;          // optional (req #2)
    importMonth?: string | null;
    dateFrom?: string | null;
    dateTo?: string | null;
    rows: ParsedRow[];
    createdById?: string;
  }) {
    if (!input.userId) throw new Error("User (owner) is required to import");

    const { data: rules } = await supabase
      .from("category_rules")
      .select("keyword,category,priority")
      .eq("active", true);

    // Resolve card: explicit selection wins; otherwise try to detect from rows.
    let card: { id: number; holder_user_id: string | null; department_id: number | null } | null =
      null;
    if (input.cardId) {
      const { data } = await supabase
        .from("corporate_cards")
        .select("id,holder_user_id,department_id")
        .eq("id", input.cardId)
        .single();
      card = data ?? null;
    } else {
      const masks = [...new Set(input.rows.map((r) => r.cardNumberMasked).filter(Boolean))];
      if (masks.length === 1) {
        const { data } = await supabase
          .from("corporate_cards")
          .select("id,holder_user_id,department_id")
          .eq("card_number_masked", masks[0])
          .maybeSingle();
        if (data) card = data;
      }
    }

    // Infer period if caller didn't supply one.
    let { dateFrom, dateTo, importMonth } = input;
    if (!dateFrom || !dateTo) {
      const dates = input.rows
        .map((r) => r.transactionDate)
        .filter((d): d is string => !!d)
        .sort();
      dateFrom = dateFrom ?? dates[0] ?? null;
      dateTo = dateTo ?? dates[dates.length - 1] ?? null;
    }
    if (!importMonth && dateFrom) importMonth = dateFrom.slice(0, 7);

    const { data: job } = await supabase
      .from("import_jobs")
      .insert({
        type: "EXCEL",
        original_name: input.fileName,
        file_path: input.fileName,
        user_id: input.userId,
        card_id: card?.id ?? null,
        import_month: importMonth ?? null,
        date_from: dateFrom ?? null,
        date_to: dateTo ?? null,
        total_rows: input.rows.length,
        created_by_id: input.createdById ?? input.userId,
        status: "CONFIRMED",
      })
      .select("id")
      .single();

    const existing = await this.excelDuplicates(input.rows);
    let imported = 0;
    let duplicates = 0;
    let errors = 0;
    const toInsert: Record<string, unknown>[] = [];
    for (const r of input.rows) {
      if (r.errors.length) {
        errors++;
        continue;
      }
      if (existing.has(dedupeKey(r))) {
        duplicates++;
        continue;
      }
      const cls = classify(r.merchantName, rules ?? []);
      toInsert.push({
        user_id: input.userId,                          // always the selected owner
        department_id: card?.department_id ?? null,
        card_id: card?.id ?? null,
        transaction_date: r.transactionDate,
        approval_date: r.approvalDate,
        payment_date: r.paymentDate,
        card_number_masked: r.cardNumberMasked,
        approval_number: r.approvalNumber,
        merchant_name: r.merchantName,
        merchant_number: r.merchantNumber,
        amount: r.amount,
        vat_amount: r.vatAmount,
        discount_amount: r.discountAmount,
        exchange_fee: r.exchangeFee,
        cancel_status: r.cancelStatus,
        transaction_type: r.transactionType,
        sales_type: r.salesType,
        category: cls.category,
        source_type: "EXCEL",
        import_job_id: job?.id ?? null,
        confidence_score: cls.confidence,
        status: cls.confidence < 0.7 ? "NEEDS_REVISION" : "AI_EXTRACTED",
      });
      imported++;
    }
    if (toInsert.length) {
      const { error } = await supabase.from("transactions").insert(toInsert);
      if (error) throw error;
    }
    if (job?.id)
      await supabase
        .from("import_jobs")
        .update({
          imported_rows: imported,
          duplicate_rows: duplicates,
          error_rows: errors,
          success_count: imported,
          failed_count: errors,
        })
        .eq("id", job.id);
    return { jobId: job?.id ?? null, imported, duplicates, errors };
  },

  // ---- Import jobs (req #3, #11.8, #12.4) -------------------------------

  async listImportJobs(opts: {
    userId?: string;
    cardId?: number;
    dateFrom?: string;
    dateTo?: string;
  } = {}): Promise<{ jobs: ImportJob[] }> {
    let q = supabase
      .from("import_jobs")
      .select(
        "*, user:users(id,name), card:corporate_cards(id,card_number_masked)",
      )
      .order("created_at", { ascending: false });
    if (opts.userId) q = q.eq("user_id", opts.userId);
    if (opts.cardId) q = q.eq("card_id", opts.cardId);
    if (opts.dateFrom) q = q.gte("created_at", opts.dateFrom);
    if (opts.dateTo) q = q.lte("created_at", `${opts.dateTo}T23:59:59`);
    const { data, error } = await q;
    if (error) throw error;
    return {
      jobs: (data ?? []).map((r: any) => ({
        id: r.id,
        userId: r.user_id,
        cardId: r.card_id,
        type: r.type,
        status: r.status,
        originalName: r.original_name,
        filePath: r.file_path,
        importMonth: r.import_month,
        dateFrom: r.date_from,
        dateTo: r.date_to,
        totalRows: r.total_rows,
        successCount: r.success_count ?? r.imported_rows ?? 0,
        failedCount: r.failed_count ?? r.error_rows ?? 0,
        duplicateRows: r.duplicate_rows ?? 0,
        createdAt: r.created_at,
        user: r.user ? { id: r.user.id, name: r.user.name } : null,
        card: r.card ? { id: r.card.id, cardNumberMasked: r.card.card_number_masked } : null,
      })),
    };
  },

  // ---- Report summary (req #6) ------------------------------------------

  async reportSummary(f: {
    userId?: string;
    cardId?: number;
    startDate: string;
    endDate: string;
  }): Promise<ReportSummary> {
    let q = supabase
      .from("transactions")
      .select(
        "amount,category,merchant_name,transaction_date,user_id,card_id, user:users(id,name), card:corporate_cards(id,card_number_masked)",
      )
      .gte("transaction_date", f.startDate)
      .lte("transaction_date", f.endDate);
    if (f.userId) q = q.eq("user_id", f.userId);
    if (f.cardId) q = q.eq("card_id", f.cardId);
    const { data, error } = await q;
    if (error) throw error;
    const rows = (data ?? []) as any[];

    const totalAmount = rows.reduce((a, r) => a + Number(r.amount), 0);

    const byCat = new Map<string, { amount: number; count: number }>();
    const byMerchant = new Map<string, { amount: number; count: number }>();
    const byDay = new Map<string, number>();
    for (const r of rows) {
      const c = r.category ?? "기타";
      const e = byCat.get(c) ?? { amount: 0, count: 0 };
      e.amount += Number(r.amount);
      e.count++;
      byCat.set(c, e);

      const m = byMerchant.get(r.merchant_name) ?? { amount: 0, count: 0 };
      m.amount += Number(r.amount);
      m.count++;
      byMerchant.set(r.merchant_name, m);

      const d = String(r.transaction_date);
      byDay.set(d, (byDay.get(d) ?? 0) + Number(r.amount));
    }
    const largest = [...rows].sort((a, b) => Number(b.amount) - Number(a.amount))[0];

    // Echo the selected user/card from rows when available (else fetch).
    let user: ReportSummary["user"] = rows[0]?.user
      ? { id: rows[0].user.id, name: rows[0].user.name }
      : null;
    let card: ReportSummary["card"] = rows[0]?.card
      ? { id: rows[0].card.id, cardNumberMasked: rows[0].card.card_number_masked }
      : null;
    if (!user && f.userId) {
      const { data: u } = await supabase
        .from("users")
        .select("id,name")
        .eq("id", f.userId)
        .single();
      if (u) user = u as any;
    }
    if (!card && f.cardId) {
      const { data: c } = await supabase
        .from("corporate_cards")
        .select("id,card_number_masked")
        .eq("id", f.cardId)
        .single();
      if (c) card = { id: c.id, cardNumberMasked: c.card_number_masked };
    }

    return {
      user,
      card,
      period: { startDate: f.startDate, endDate: f.endDate },
      totalAmount,
      transactionCount: rows.length,
      categoryBreakdown: [...byCat.entries()]
        .map(([category, v]) => ({
          category,
          label: CATEGORY_LABELS[category] ?? "Others",
          amount: v.amount,
          count: v.count,
          percentage: totalAmount ? Number(((v.amount / totalAmount) * 100).toFixed(1)) : 0,
        }))
        .sort((a, b) => b.amount - a.amount),
      topMerchants: [...byMerchant.entries()]
        .map(([merchantName, v]) => ({ merchantName, ...v }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5),
      largestTransaction: largest
        ? {
            merchantName: largest.merchant_name,
            amount: Number(largest.amount),
            transactionDate: largest.transaction_date,
          }
        : null,
      dailySpending: [...byDay.entries()]
        .map(([date, amount]) => ({ date: date.slice(5), amount }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    };
  },
};

const snake = (o: Record<string, unknown>) => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined) continue;
    out[k.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)] = v;
  }
  return out;
};
