import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import dayjs from "dayjs";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

/** 6058150 → "6,058,150원" */
export const won = (n: number | null | undefined) =>
  `${Number(n ?? 0).toLocaleString("ko-KR")}원`;

export const num = (n: number | null | undefined) =>
  Number(n ?? 0).toLocaleString("ko-KR");

export const fmtDate = (d?: string | null) => (d ? dayjs(d).format("YYYY.MM.DD") : "-");

export const currentMonth = () => dayjs().format("YYYY-MM");

export const CATEGORY_COLORS: Record<string, string> = {
  식음료: "#2563eb",
  교통: "#14b8a6",
  "숙박/여행": "#f59e0b",
  레저: "#a855f7",
  소프트웨어: "#0ea5e9",
  사무용품: "#10b981",
  접대비: "#ef4444",
  기타: "#94a3b8",
};

export const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  AI_EXTRACTED: "bg-sky-100 text-sky-700",
  SUBMITTED: "bg-amber-100 text-amber-700",
  NEEDS_REVISION: "bg-orange-100 text-orange-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-rose-100 text-rose-700",
};
