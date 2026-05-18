import * as XLSX from "xlsx";
import { autoMapColumns, NormalizedField } from "./columnMap";
import { maskCardNumber } from "../../utils/mask";

export interface ParsedTransaction {
  rowIndex: number;
  transactionDate: string | null;
  approvalDate: string | null;
  paymentDate: string | null;
  cardNumberMasked: string;
  cardLast4: string;
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

export interface ParseResult {
  headers: string[];
  autoMapping: Record<string, NormalizedField | null>;
  rows: ParsedTransaction[];
}

const toNumber = (v: unknown): number => {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return Math.round(v);
  const n = Number(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? Math.round(n) : 0;
};

/** Normalizes "20260303", "2026.03.03", "2026-3-3", Excel serial → ISO date. */
const toDate = (v: unknown): string | null => {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = String(v).trim();
  const digits = s.replace(/[^0-9]/g, "");
  if (digits.length === 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  }
  const m = s.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
};

/** Parse a workbook buffer into preview rows + an editable column mapping. */
export function parseWorkbook(
  buffer: Buffer,
  overrideMapping?: Record<string, NormalizedField | null>,
): ParseResult {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  const headers = json.length ? Object.keys(json[0]) : [];
  const mapping = overrideMapping ?? autoMapColumns(headers);

  const inverse = (field: NormalizedField): string | undefined =>
    Object.entries(mapping).find(([, f]) => f === field)?.[0];

  const get = (record: Record<string, unknown>, field: NormalizedField): unknown => {
    const col = inverse(field);
    return col ? record[col] : undefined;
  };

  const rows: ParsedTransaction[] = json.map((record, i) => {
    const errors: string[] = [];
    const merchantName = String(get(record, "merchant_name") ?? "").trim();
    const amount = toNumber(get(record, "amount"));
    const transactionDate = toDate(get(record, "transaction_date"));
    const rawCard = String(get(record, "card_number") ?? "").trim();
    const { masked, last4 } = maskCardNumber(rawCard);

    if (!merchantName) errors.push("merchant_name is required");
    if (!amount) errors.push("amount is required");
    if (!transactionDate) errors.push("transaction_date is required");

    return {
      rowIndex: i + 2, // +2: header row + 1-based
      transactionDate,
      approvalDate: toDate(get(record, "approval_date")),
      paymentDate: toDate(get(record, "payment_date")),
      cardNumberMasked: masked,
      cardLast4: last4,
      approvalNumber: String(get(record, "approval_number") ?? "").trim() || null,
      merchantName,
      merchantNumber: String(get(record, "merchant_number") ?? "").trim() || null,
      amount,
      vatAmount: toNumber(get(record, "vat_amount")),
      discountAmount: toNumber(get(record, "discount_amount")),
      exchangeFee: toNumber(get(record, "exchange_fee")),
      cancelStatus: String(get(record, "cancel_status") ?? "").trim() || null,
      transactionType: String(get(record, "transaction_type") ?? "").trim() || null,
      salesType: String(get(record, "sales_type") ?? "").trim() || null,
      errors,
    };
  });

  return { headers, autoMapping: mapping, rows };
}

/** Deterministic dedupe key: card + approval# + amount + date. */
export const dedupeKey = (t: {
  cardNumberMasked: string;
  approvalNumber: string | null;
  amount: number;
  transactionDate: string | null;
}) => `${t.cardNumberMasked}|${t.approvalNumber ?? ""}|${t.amount}|${t.transactionDate ?? ""}`;
