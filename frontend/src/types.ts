export type Role = "ADMIN" | "ACCOUNTANT" | "USER";

export type TransactionStatus =
  | "DRAFT"
  | "AI_EXTRACTED"
  | "SUBMITTED"
  | "NEEDS_REVISION"
  | "APPROVED"
  | "REJECTED";

export type SourceType = "EXCEL" | "PDF" | "IMAGE" | "MANUAL";

// user ids are Supabase Auth UUIDs (strings); other entities use numeric ids.
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface Department {
  id: number;
  name: string;
}

export interface UserRow {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  department?: Department | null;
  _count: { cards: number; transactions: number };
}

export interface CardRow {
  id: number;
  cardNumberMasked: string;
  last4: string;
  issuer?: string | null;
  active: boolean;
  holder?: { id: string; name: string } | null;
  department?: Department | null;
  _count: { transactions: number };
}

export interface ImportJob {
  id: number;
  userId: string;
  cardId?: number | null;
  type: SourceType;
  status: string;
  originalName: string;
  filePath?: string | null;
  importMonth?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  totalRows: number;
  successCount: number;
  failedCount: number;
  duplicateRows: number;
  createdAt: string;
  user?: { id: string; name: string } | null;
  card?: { id: number; cardNumberMasked: string } | null;
}

export interface ReportSummary {
  user: { id: string; name: string } | null;
  card: { id: number; cardNumberMasked: string } | null;
  period: { startDate: string; endDate: string };
  totalAmount: number;
  transactionCount: number;
  categoryBreakdown: { category: string; label: string; amount: number; percentage: number; count: number }[];
  topMerchants: { merchantName: string; amount: number; count: number }[];
  largestTransaction: { merchantName: string; amount: number; transactionDate: string } | null;
  dailySpending: { date: string; amount: number }[];
}

export interface Transaction {
  id: number;
  transactionDate: string;
  approvalDate?: string | null;
  paymentDate?: string | null;
  cardNumberMasked: string;
  approvalNumber?: string | null;
  merchantName: string;
  merchantNumber?: string | null;
  amount: number;
  vatAmount: number;
  discountAmount: number;
  exchangeFee: number;
  category?: string | null;
  purpose: string;
  memo: string;
  sourceType: SourceType;
  confidenceScore?: number | null;
  status: TransactionStatus;
  user?: { id: string; name: string } | null;
  department?: Department | null;
  card?: { id: number; cardNumberMasked: string } | null;
  importJob?: { id: number; originalName: string } | null;
  reviewLogs?: ReviewLog[];
}

export interface ReviewLog {
  id: number;
  action: string;
  fromStatus?: TransactionStatus | null;
  toStatus?: TransactionStatus | null;
  comment?: string | null;
  createdAt: string;
  reviewer?: { name: string } | null;
}

export interface TransactionPage {
  rows: Transaction[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  totalAmount: number;
}

export interface CategorySlice {
  category: string;
  label: string;
  amount: number;
  count: number;
  percent?: number;
}

export interface DashboardSummary {
  summary: {
    totalAmount: number;
    totalCount: number;
    userCount: number;
    cardCount: number;
    needsReview: number;
    missingPurpose: number;
  };
  byCategory: CategorySlice[];
}

export interface UserDashboard {
  title: string;
  subtitle: string;
  summary: {
    totalAmount: number;
    totalCount: number;
    cards: string[];
    periodStart: string;
    periodEnd: string;
    periodLabel: string;
  };
  byCategory: CategorySlice[];
  topMerchants: { merchantName: string; amount: number; count: number }[];
  largest: { merchantName: string; amount: number; transactionDate: string } | null;
  daily: { date: string; amount: number }[];
}
