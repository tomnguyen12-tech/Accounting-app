/**
 * Maps Korean corporate-card Excel headers to the normalized transaction
 * schema. Header text is matched loosely (whitespace/case-insensitive) and
 * the UI lets the user override the mapping when auto-detection fails.
 */
export type NormalizedField =
  | "no"
  | "transaction_date"
  | "approval_date"
  | "card_number"
  | "transaction_type"
  | "sales_type"
  | "approval_number"
  | "merchant_name"
  | "merchant_number"
  | "amount"
  | "cancel_status"
  | "exchange_fee"
  | "discount_amount"
  | "payment_date"
  | "vat_amount";

export const HEADER_ALIASES: Record<NormalizedField, string[]> = {
  no: ["NO", "번호", "순번"],
  transaction_date: ["이용일자", "거래일자", "사용일자", "transaction_date", "date"],
  approval_date: ["매입일자", "승인일자", "approval_date"],
  card_number: ["카드번호", "card_number", "card no"],
  transaction_type: ["구분", "transaction_type"],
  sales_type: ["매출구분", "sales_type"],
  approval_number: ["승인번호", "approval_number", "approval no"],
  merchant_name: ["가맹점명", "가맹점", "merchant", "merchant_name", "상호"],
  merchant_number: ["가맹점번호", "merchant_number"],
  amount: ["매출금액", "이용금액", "금액", "amount", "총금액"],
  cancel_status: ["취소구분", "cancel_status"],
  exchange_fee: ["환가료", "exchange_fee"],
  discount_amount: ["할인금액", "discount_amount"],
  payment_date: ["결제일자", "payment_date"],
  vat_amount: ["부가세", "부가가치세", "vat", "vat_amount"],
};

const norm = (s: string) => String(s ?? "").replace(/\s|_/g, "").toLowerCase();

/** Auto-detect mapping: header → normalized field. */
export function autoMapColumns(headers: string[]): Record<string, NormalizedField | null> {
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
