# Hướng dẫn deploy lên Vercel (tự làm, ~10–15 phút)

Kiến trúc khi lên Vercel:

```
[ Frontend Vercel project ]  ──HTTPS──>  [ Backend Vercel project ]  ──>  [ Neon PostgreSQL ]
   (Vite static)                            (Express serverless)            (DB online, free)
```

Bạn sẽ tạo **2 project Vercel** (cùng 1 repo GitHub, khác Root Directory) + **1 database Neon**.
Không cần đưa token/mật khẩu cho ai.

---

## Bước 1 — Tạo PostgreSQL online (Neon, miễn phí)

1. Vào https://neon.tech → đăng nhập bằng GitHub → **Create project** (chọn region gần, vd Singapore).
2. Sau khi tạo, mở tab **Connection string** → chọn **Pooled connection** → copy chuỗi dạng:
   ```
   postgresql://USER:PASSWORD@ep-xxx-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```
   Giữ chuỗi này lại — gọi là `DATABASE_URL`.

## Bước 2 — Nạp bảng + dữ liệu mẫu vào Neon (làm 1 lần, từ máy bạn)

Tại thư mục `backend`, dùng tạm `DATABASE_URL` của Neon:

```powershell
cd C:\Code\expense-assistant\backend
$env:DATABASE_URL = "postgresql://...neon...?sslmode=require"   # dán chuỗi Neon
npm install
npm run prisma:push          # tạo toàn bộ 8 bảng trên Neon (không cần file migration)
npm run seed                 # nạp admin/kế toán/Kevin + 49 giao dịch tháng 3
```

> Dùng `prisma:push` (= `prisma db push`) vì repo chưa kèm file migration — lệnh này
> đồng bộ thẳng `schema.prisma` lên Neon. Khi cần versioning sau này thì chuyển sang
> `prisma migrate`.

## Bước 3 — Deploy BACKEND lên Vercel

1. https://vercel.com → **Add New… → Project** → **Import** repo `tomnguyen12-tech/Accounting-app`.
2. Cấu hình:
   - **Root Directory:** `backend`  ← quan trọng
   - **Framework Preset:** Other
   - Build Command / Output: để mặc định (vercel.json đã lo phần serverless).
3. Mục **Environment Variables**, thêm:
   | Name | Value |
   |------|-------|
   | `DATABASE_URL` | chuỗi Neon **pooled** ở Bước 1 |
   | `JWT_SECRET` | một chuỗi bí mật bất kỳ (vd `mySuperSecret_2026`) |
   | `CORS_ORIGIN` | tạm để `*` (sẽ sửa ở Bước 5) |
4. **Deploy**. Xong sẽ có URL, vd `https://accounting-app-api.vercel.app`.
5. Kiểm tra nhanh: mở `https://<backend-url>/health` → phải thấy `{"ok":true}`.

## Bước 4 — Deploy FRONTEND lên Vercel

1. **Add New… → Project** → import **cùng repo** lần nữa.
2. Cấu hình:
   - **Root Directory:** `frontend`  ← quan trọng
   - **Framework Preset:** Vite (Vercel tự nhận)
3. **Environment Variables**:
   | Name | Value |
   |------|-------|
   | `VITE_API_URL` | URL backend ở Bước 3, vd `https://accounting-app-api.vercel.app` (không có `/` cuối) |
4. **Deploy**. Xong sẽ có URL frontend, vd `https://accounting-app.vercel.app` → **đây là link bạn test**.

## Bước 5 — Khoá CORS lại (khuyến nghị)

Quay lại **project backend** trên Vercel → Settings → Environment Variables → sửa
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

| Triệu chứng | Nguyên nhân & cách xử lý |
|---|---|
| Login lỗi mạng / CORS | `CORS_ORIGIN` backend chưa đúng URL frontend → sửa env, redeploy backend. Test nhanh: để `*`. |
| `/health` 500, log "Can't reach database" | Sai `DATABASE_URL`, hoặc chưa dùng chuỗi **pooled** của Neon, thiếu `?sslmode=require`. |
| Trang trắng khi F5 ở `/transactions` | Thiếu SPA rewrite — đã có sẵn `frontend/vercel.json`, đảm bảo Root Directory = `frontend`. |
| Login OK nhưng không có dữ liệu | Chưa chạy `npm run seed` ở Bước 2 (chạy lại, trỏ `DATABASE_URL` về Neon). |
| Prisma "query engine not found" | Đã thêm sẵn `binaryTargets rhel-openssl-3.0.x` + `postinstall: prisma generate`; chỉ cần **Redeploy** (clear build cache). |

> Gợi ý: dùng **Vercel ↔ Neon integration** (Vercel Marketplace → Neon) để tự bơm `DATABASE_URL`
> vào project backend, đỡ phải copy tay.
