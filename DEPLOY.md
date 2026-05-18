# Chạy & Deploy (kiến trúc KHÔNG backend — Frontend + Supabase)

```
[ React (Vite) ]  ──@supabase/supabase-js──>  [ Supabase: Postgres + Auth + RLS ]
```

Không còn dùng backend Express. Thư mục `backend/` giữ lại để tham khảo nhưng **không deploy**.

---

## Bước 1 — Tạo schema + seed trong Supabase (1 lần)

1. Mở Supabase project → **SQL Editor → New query**.
2. Mở file `supabase/schema.sql` trong repo, copy **toàn bộ**, dán vào, bấm **Run**.
   - Tạo 8 bảng + RLS (chỉ user đã đăng nhập mới truy cập được).
   - Trigger: khi ai đó **đăng ký**, tự tạo hồ sơ + gán role/phòng ban theo email demo;
     riêng `kevin@demo.io` được tự gán thẻ + 49 giao dịch tháng 3 (đúng 6,058,150원).

## Bước 2 — Tắt xác nhận email (để demo đăng ký xong dùng ngay)

Supabase → **Authentication → Sign In / Providers → Email** → **tắt "Confirm email"** → Save.
(Nếu để bật, sau khi Sign up phải vào email bấm xác nhận mới đăng nhập được.)

## Bước 3 — Lấy khoá API cho frontend

Supabase → **Project Settings → API**:
- **Project URL** → vd `https://ikphfyyueaezyvzhaowm.supabase.co`
- **Project API keys → `anon` `public`** → chuỗi JWT dài (đây là khoá công khai, RLS bảo vệ dữ liệu)

Điền vào `frontend/.env`:
```
VITE_SUPABASE_URL=https://ikphfyyueaezyvzhaowm.supabase.co
VITE_SUPABASE_ANON_KEY=<dán anon public key>
```

## Bước 4 — Chạy local

```powershell
cd C:\Code\expense-assistant\frontend
npm install
npm run dev        # http://localhost:5173
```

Mở http://localhost:5173 → tab **계정 만들기 / Sign up** → đăng ký lần lượt:

| Email | Mật khẩu | Vai trò tự gán |
|---|---|---|
| `kevin@demo.io` | `kevin123` | USER (Sales) — có sẵn thẻ + 49 giao dịch 3월 |
| `admin@demo.io` | `admin123` | ADMIN |
| `acct@demo.io` | `acct123` | ACCOUNTANT |

Sau đó **로그인 / Sign in** bằng `kevin@demo.io` → vào **월별 리포트** thấy
*Kevin 3월 … 6,058,150원 / 49건* + biểu đồ tròn.

## Bước 5 — Deploy lên Vercel (chỉ 1 project frontend)

1. https://vercel.com → **Add New → Project** → import repo `tomnguyen12-tech/Accounting-app`.
2. **Root Directory:** `frontend` · Framework: **Vite** (tự nhận).
3. **Environment Variables:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (giá trị như Bước 3).
4. **Deploy** → ra link `https://<project>.vercel.app` → **đây là link test online**.
5. Supabase → **Authentication → URL Configuration**: thêm domain Vercel vào
   **Site URL / Redirect URLs**.

---

## Lỗi thường gặp

| Triệu chứng | Cách xử lý |
|---|---|
| Console: "VITE_SUPABASE… chưa cấu hình" | Chưa điền `frontend/.env` (Bước 3), hoặc chưa restart `npm run dev`. |
| Sign up xong không vào được | Chưa tắt "Confirm email" (Bước 2), hoặc email cần xác nhận. |
| Login OK nhưng mọi trang trống / lỗi 401-RLS | Chưa chạy `supabase/schema.sql` (Bước 1) → thiếu bảng/policy. |
| Kevin không thấy 49 giao dịch | Phải **Sign up đúng** `kevin@demo.io` (trigger khớp email mới gán dữ liệu seed). |
| Trang trắng khi F5 trên Vercel | Đã có `frontend/vercel.json` (SPA rewrite) — đảm bảo Root Directory = `frontend`. |
| Đổi mật khẩu DB | Anon key không liên quan mật khẩu Postgres; có thể đổi password DB tuỳ ý. |
