# Hướng dẫn deploy lên Vercel + Supabase (tự làm, ~10–15 phút)

Kiến trúc khi lên Vercel:

```
[ Frontend Vercel project ]  ──HTTPS──>  [ Backend Vercel project ]  ──>  [ Supabase PostgreSQL ]
   (Vite static)                            (Express serverless)            (DB online, free)
```

Bạn tạo **2 project Vercel** (cùng 1 repo GitHub, khác Root Directory) + **1 DB Supabase**.
Không cần đưa token/mật khẩu cho ai. App dùng PostgreSQL nên Supabase cắm thẳng được,
**không phải sửa code**.

---

## Bước 1 — Tạo PostgreSQL trên Supabase (miễn phí)

1. Vào https://supabase.com → **Sign in** bằng GitHub → **New project**.
2. Điền:
   - **Name:** tuỳ ý (vd `accounting-app`)
   - **Database Password:** đặt một mật khẩu mạnh → **GHI LẠI NGAY** (sẽ cần để ráp chuỗi kết nối; không xem lại được).
   - **Region:** Southeast Asia (Singapore) cho gần.
   - **Plan:** Free.
3. Bấm **Create new project**, đợi ~2 phút cho provisioning xong.
4. Bấm nút **Connect** (góc trên dashboard) → tab **Connection string**. Bạn sẽ thấy 3 loại — ta dùng 2:

   | Loại | Cổng | Dùng để |
   |------|------|---------|
   | **Session pooler** | `5432` | Chạy `prisma db push` + `seed` ở Bước 2 (ổn định cho DDL, hỗ trợ IPv4) |
   | **Transaction pooler** | `6543` | Biến môi trường `DATABASE_URL` trên Vercel (hợp serverless) |

   Cả hai dạng:
   ```
   Session:     postgresql://postgres.<ref>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres
   Transaction: postgresql://postgres.<ref>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:6543/postgres
   ```
   Thay `<PASSWORD>` bằng mật khẩu DB ở mục 2 (nếu mật khẩu có ký tự đặc biệt như `@ # /` thì
   phải URL-encode, vd `@`→`%40`).

## Bước 2 — Nạp bảng + dữ liệu mẫu vào Supabase (làm 1 lần, từ máy bạn)

Dùng chuỗi **Session pooler (cổng 5432)**:

```powershell
cd C:\Code\expense-assistant\backend
$env:DATABASE_URL = "postgresql://postgres.<ref>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres"
npm install
npm run prisma:push          # tạo toàn bộ 8 bảng trên Supabase
npm run seed                 # nạp admin/kế toán/Kevin + 49 giao dịch tháng 3
```

Thấy dòng `Seed complete — Kevin: 49 txns, total 6,058,150원` là thành công.
(Có thể vào Supabase → **Table Editor** kiểm tra các bảng `users`, `transactions`…)

## Bước 3 — Deploy BACKEND lên Vercel

1. https://vercel.com → **Add New… → Project** → **Import** repo `tomnguyen12-tech/Accounting-app`.
2. Cấu hình:
   - **Root Directory:** `backend`  ← quan trọng
   - **Framework Preset:** Other
   - Build/Output: để mặc định (đã có `backend/vercel.json`).
3. **Environment Variables**:
   | Name | Value |
   |------|-------|
   | `DATABASE_URL` | chuỗi **Transaction pooler (cổng 6543)**, thêm đuôi `?pgbouncer=true&connection_limit=1` |
   | `JWT_SECRET` | chuỗi bí mật bất kỳ (vd `mySuperSecret_2026`) |
   | `CORS_ORIGIN` | tạm để `*` (sẽ siết lại ở Bước 5) |

   Ví dụ `DATABASE_URL`:
   ```
   postgresql://postgres.<ref>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
   ```
4. **Deploy** → có URL backend, vd `https://accounting-app-api.vercel.app`.
5. Test: mở `https://<backend-url>/health` → phải thấy `{"ok":true}`.

## Bước 4 — Deploy FRONTEND lên Vercel

1. **Add New… → Project** → import **cùng repo** lần nữa.
2. Cấu hình:
   - **Root Directory:** `frontend`  ← quan trọng
   - **Framework Preset:** Vite (Vercel tự nhận)
3. **Environment Variables**:
   | Name | Value |
   |------|-------|
   | `VITE_API_URL` | URL backend ở Bước 3, vd `https://accounting-app-api.vercel.app` (không có `/` cuối) |
4. **Deploy** → có URL frontend, vd `https://accounting-app.vercel.app` → **đây là link bạn test**.

## Bước 5 — Siết CORS lại (khuyến nghị)

Project **backend** trên Vercel → Settings → Environment Variables → sửa
`CORS_ORIGIN` = URL frontend (vd `https://accounting-app.vercel.app`) → **Redeploy** backend.

---

## Đăng nhập test

Mở URL frontend → đăng nhập:

| Vai trò | Email | Mật khẩu |
|---|---|---|
| User (Kevin) | `kevin@demo.io` | `kevin123` |
| Admin | `admin@demo.io` | `admin123` |
| Kế toán | `acct@demo.io` | `acct123` |

Vào **월별 리포트 / Monthly Report** (Kevin) → thấy đúng *6,058,150원 / 49건* + biểu đồ tròn.

---

## Lỗi thường gặp

| Triệu chứng | Cách xử lý |
|---|---|
| `prisma:push` báo `password authentication failed` | Sai `<PASSWORD>`, hoặc mật khẩu có ký tự đặc biệt chưa URL-encode (`@`→`%40`, `#`→`%23`). |
| `prisma:push`/`seed` treo, không kết nối | Đang dùng chuỗi **Direct** (IPv6) — đổi sang chuỗi **Session pooler (5432)**. |
| `/health` 500, log "Can't reach database" | `DATABASE_URL` trên Vercel sai, hoặc thiếu `?pgbouncer=true&connection_limit=1` ở chuỗi Transaction pooler. |
| Login lỗi mạng / CORS | `CORS_ORIGIN` backend chưa khớp URL frontend → sửa env, redeploy. Test nhanh để `*`. |
| Trang trắng khi F5 ở `/transactions` | Đảm bảo project frontend có **Root Directory = `frontend`** (đã kèm `frontend/vercel.json`). |
| Login OK nhưng trống dữ liệu | Chưa chạy `npm run seed` ở Bước 2 (chạy lại, trỏ `DATABASE_URL` về Supabase). |
| Prisma "query engine not found" trên Vercel | Đã thêm sẵn `binaryTargets rhel-openssl-3.0.x` + `postinstall: prisma generate` → chỉ cần **Redeploy** (Clear build cache). |

> Mẹo: tab **Connect → ORMs → Prisma** trong Supabase cho sẵn 2 chuỗi `DATABASE_URL`
> (transaction) và `DIRECT_URL` (session) — copy đúng theo bảng trên là chạy.
