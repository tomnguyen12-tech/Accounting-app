import * as XLSX from "xlsx";

export type NormalizedField =
  | "transaction_date"
  | "approval_date"
  | "payment_date"
  | "card_number"
  | "approval_number"
  | "merchant_name"
  | "merchant_number"
  | "amount"
  | "vat_amount"
  | "discount_amount"
  | "exchange_fee"
  | "cancel_status"
  | "transaction_type"
  | "sales_type";

const HEADER_ALIASES: Record<NormalizedField, string[]> = {
  transaction_date: ["이용일자", "거래일자", "사용일자", "date"],
  approval_date: ["매입일자", "승인일자"],
  payment_date: ["결제일자"],
  card_number: ["카드번호", "card number"],
  approval_number: ["승인번호"],
  merchant_name: ["가맹점명", "가맹점", "상호", "merchant"],
  merchant_number: ["가맹점번호"],
  amount: ["매출금액", "이용금액", "금액", "총금액", "amount"],
  vat_amount: ["부가세", "부가가치세", "vat"],
  discount_amount: ["할인금액"],
  exchange_fee: ["환가료"],
  cancel_status: ["취소구분"],
  transaction_type: ["구분"],
  sales_type: ["매출구분"],
};

const norm = (s: string) => String(s ?? "").replace(/\s|_/g, "").toLowerCase();

export function autoMapColumns(headers: string[]) {
  const mapping: Record<string, NormalizedField | null> = {};
  for (const header of headers) {
    const h = norm(header);
    let match: NormalizedField | null = null;
    for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [
      NormalizedField,
      string[],
    ][]) {
      if (aliases.some((a) => norm(a) === h || h.includes(norm(a)))) {
        match = field;
        break;
      }
    }
    mapping[header] = match;
  }
  return mapping;
}

export function maskCardNumber(raw: string) {
  const digits = (raw ?? "").replace(/[^0-9]/g, "");
  if (digits.length >= 8) {
    return {
      masked: `${digits.slice(0, 4)}-****-****-${digits.slice(-4)}`,
      last4: digits.slice(-4),
    };
  }
  const m = (raw ?? "").match(/(\d{4}).*?(\d{4})\s*$/);
  if (m) return { masked: `${m[1]}-****-****-${m[2]}`, last4: m[2] };
  return { masked: raw || "UNKNOWN", last4: digits.slice(-4) || "0000" };
}

const toNumber = (v: unknown): number => {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return Math.round(v);
  const n = Number(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? Math.round(n) : 0;
};

const toDate = (v: unknown): string | null => {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = String(v).trim();
  const digits = s.replace(/[^0-9]/g, "");
  if (digits.length === 8)
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  const m = s.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
};

export interface ParsedRow {
  rowIndex: number;
  transactionDate: string | null;
  approvalDate: string | null;
  paymentDate: string | null;
  cardNumberMasked: string;
  approvalNumber: string | null;
  merchantName: string;
  merchantNumber: string | null;
  amount: number;
  vatAmount: number;
  discountAmount: number;
  exchangeFee: number;
  cancelStatus: string | null;
  transactionType: string | null;
  salesType: string | null;
  errors: string[];
}

export function parseWorkbook(
  buffer: ArrayBuffer,
  overrideMapping?: Record<string, NormalizedField | null>,
) {
  const wb = XLSX.read(buffer, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  const headers = json.length ? Object.keys(json[0]) : [];
  const mapping = overrideMapping ?? autoMapColumns(headers);

  const inverse = (f: NormalizedField) =>
    Object.entries(mapping).find(([, mf]) => mf === f)?.[0];
  const get = (rec: Record<string, unknown>, f: NormalizedField) => {
    const col = inverse(f);
    return col ? rec[col] : undefined;
  };

  const rows: ParsedRow[] = json.map((rec, i) => {
    const errors: string[] = [];
    const merchantName = String(get(rec, "merchant_name") ?? "").trim();
    const amount = toNumber(get(rec, "amount"));
    const transactionDate = toDate(get(rec, "transaction_date"));
    const { masked } = maskCardNumber(String(get(rec, "card_number") ?? "").trim());
    if (!merchantName) errors.push("merchant_name required");
    if (!amount) errors.push("amount required");
    if (!transactionDate) errors.push("transaction_date required");
    return {
      rowIndex: i + 2,
      transactionDate,
      approvalDate: toDate(get(rec, "approval_date")),
      paymentDate: toDate(get(rec, "payment_date")),
      cardNumberMasked: masked,
      approvalNumber: String(get(rec, "approval_number") ?? "").trim() || null,
      merchantName,
      merchantNumber: String(get(rec, "merchant_number") ?? "").trim() || null,
      amount,
      vatAmount: toNumber(get(rec, "vat_amount")),
      discountAmount: toNumber(get(rec, "discount_amount")),
      exchangeFee: toNumber(get(rec, "exchange_fee")),
      cancelStatus: String(get(rec, "cancel_status") ?? "").trim() || null,
      transactionType: String(get(rec, "transaction_type") ?? "").trim() || null,
      salesType: String(get(rec, "sales_type") ?? "").trim() || null,
      errors,
    };
  });

  return { headers, autoMapping: mapping, rows };
}

export const dedupeKey = (t: {
  cardNumberMasked: string;
  approvalNumber: string | null;
  amount: number;
  transactionDate: string | null;
}) => `${t.cardNumberMasked}|${t.approvalNumber ?? ""}|${t.amount}|${t.transactionDate ?? ""}`;

/** Rule-based classifier (rules loaded from category_rules table). */
export function classify(
  merchant: string,
  rules: { keyword: string; category: string; priority: number }[],
): { category: string; confidence: number } {
  const name = (merchant ?? "").toLowerCase();
  for (const r of [...rules].sort((a, b) => a.priority - b.priority)) {
    if (name.includes(r.keyword.toLowerCase()))
      return { category: r.category, confidence: 0.92 };
  }
  return { category: "기타", confidence: 0.4 };
}
