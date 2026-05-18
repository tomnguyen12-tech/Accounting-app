# AI Expense & Corporate Card Accounting Assistant

An AI-assisted web app to import corporate-card spending from Excel/PDF/receipt images,
normalize and classify transactions, and visualize monthly spend by user, card, category and merchant.

This repository delivers **Phase 1 (MVP)** as a fully runnable application, with the
OCR / AI layer designed as swappable interfaces so **Phase 2/3** can be added without refactoring.

## Phase status

| Phase | Scope | Status |
|------|-------|--------|
| **Phase 1** | DB schema, User/Card/Transaction CRUD, Excel import, transaction list + filters, monthly dashboard, category pie chart, purpose/memo editing, review status | ✅ Implemented |
| Phase 2 | PDF import, image receipt OCR, AI classification, approval workflow | 🧩 Interfaces + mocks in place (`src/services/ocr`, `src/services/ai`) |
| Phase 3 | Excel/PDF export, missing-receipt detection, advanced analytics, full i18n | 🗺️ Architecture ready |

## Tech stack

- **Frontend:** React + TypeScript + Vite, Tailwind CSS (shadcn-style components), Recharts
- **Backend:** Node.js + Express + TypeScript
- **DB:** PostgreSQL + Prisma ORM
- **Upload:** Multer · **Excel:** SheetJS (`xlsx`) · **Auth:** JWT + bcrypt

## Project structure

```
expense-assistant/
├─ docker-compose.yml          # PostgreSQL for local dev
├─ backend/
│  ├─ prisma/
│  │  ├─ schema.prisma         # 8 tables: users, departments, corporate_cards,
│  │  │                        # transactions, receipt_files, import_jobs,
│  │  │                        # category_rules, review_logs
│  │  └─ seed.ts               # admin/accountant/Kevin + cards + ~49 Mar-2026 txns
│  └─ src/
│     ├─ app.ts / index.ts
│     ├─ middleware/            # auth, error handling
│     ├─ services/
│     │  ├─ excel/              # SheetJS parser + column mapper + dedupe
│     │  ├─ category/           # rule-based classifier
│     │  ├─ ocr/                # OcrService interface + MockOcrService (Phase 2)
│     │  └─ ai/                 # AiClassifier interface + MockAiClassifier
│     ├─ controllers/           # auth, users, cards, transactions, import, dashboard
│     └─ routes/
└─ frontend/
   └─ src/
      ├─ pages/                 # Login, Dashboard, Users, Cards, Import,
      │                         # Transactions, TransactionDetail, MonthlyReport, Settings
      ├─ components/ui/         # Button, Card, Input, Select, Badge, Table
      └─ lib/                   # api client, formatters
```

## Run locally

See [docs at the bottom](#quick-start). TL;DR:

```bash
# 1. Start PostgreSQL
docker compose up -d

# 2. Backend
cd backend
cp .env.example .env
npm install
npm run prisma:migrate      # creates tables
npm run seed                # loads demo data
npm run dev                 # http://localhost:4000

# 3. Frontend (new terminal)
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

**Demo logins**

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@demo.io` | `admin123` |
| Accountant | `acct@demo.io` | `acct123` |
| User (Kevin) | `kevin@demo.io` | `kevin123` |

## Quick start

1. **PostgreSQL** — `docker compose up -d` (exposes `localhost:5432`, db `expense`).
   No Docker? Point `DATABASE_URL` in `backend/.env` at any Postgres 14+.
2. **Backend** — `cd backend && cp .env.example .env && npm i && npm run prisma:migrate && npm run seed && npm run dev`
3. **Frontend** — `cd frontend && npm i && npm run dev`, open http://localhost:5173, log in as `kevin@demo.io / kevin123`.

The dashboard reproduces the spec example: *Kevin 3월 카드 이용내역 요약* — 총 사용금액 6,058,150원 / 49건 / 4835-****-****-7498.
