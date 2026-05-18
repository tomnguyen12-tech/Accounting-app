# Chạy & Deploy (DEMO MODE — không Auth, không email, chỉ CRUD)

```
[ React (Vite) ]  ──@supabase/supabase-js (publishable key)──>  [ Supabase Postgres ]
```

Không dùng backend Express, không Supabase Auth, không xác nhận email.
Login = chọn user seed có sẵn (không kiểm mật khẩu). RLS mở để CRUD chạy ngay.
⚠️ Chỉ để test — dữ liệu không bảo mật.

---

## Bước 1 — Chạy SQL (1 lần, có thể chạy lại bất kỳ lúc nào)

1. Mở `supabase/schema.sql` ([GitHub](https://github.com/tomnguyen12-tech/Accounting-app/blob/main/supabase/schema.sql)) → copy **toàn bộ**.
2. Supabase → **SQL Editor → New query** → dán → **Run**.
   - Đầu file có khối RESET (drop & tạo lại sạch) → chạy lại bao nhiêu lần cũng được.
   - Tạo 8 bảng + RLS mở + 4 user seed + thẻ + 49 giao dịch tháng 3 của Kevin (6,058,150원).

## Bước 2 — Khoá API cho frontend

`frontend/.env` (đã điền sẵn nếu chạy local theo phiên trước):
```
VITE_SUPABASE_URL=https://ikphfyyueaezyvzhaowm.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...        # publishable key
```

## Bước 3 — Chạy local

```powershell
cd C:\Code\expense-assistant\frontend
npm install
npm run dev        # http://localhost:5173
```

Mở **http://localhost:5173** → ở khung "데모 계정" bấm dòng **Kevin** → bấm
**로그인 / Sign in** → vào **월별 리포트** → thấy *Kevin 3월 … 6,058,150원 / 49건* + biểu đồ tròn.

| Click để đăng nhập | Vai trò |
|---|---|
| `kevin@demo.io` | USER (Sales) — có thẻ + 49 giao dịch 3월 |
| `admin@demo.io` | ADMIN |
| `acct@demo.io`  | ACCOUNTANT |

> Không cần đăng ký, không cần email, không cần mật khẩu đúng — chỉ cần email
> tồn tại trong bảng `users` (đã seed ở Bước 1).

## Bước 4 — Deploy Vercel (chỉ 1 project frontend)

1. Vercel → Add New → Project → import repo → **Root Directory: `frontend`** (Vite tự nhận).
2. Env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` như Bước 2.
3. Deploy → `https://<project>.vercel.app` = link test online.

---

## Lỗi thường gặp

| Triệu chứng | Cách xử lý |
|---|---|
| Login báo "Tài khoản không tồn tại…" | Chưa chạy `supabase/schema.sql` (Bước 1), hoặc gõ sai email. |
| Console "VITE_SUPABASE… chưa cấu hình" | Thiếu `frontend/.env` → điền rồi restart `npm run dev`. |
| Trang trống / lỗi RLS 401 | Chạy lại `schema.sql` (khối RLS mở cho anon nằm trong đó). |
| Kevin không có 49 giao dịch | Chạy lại `schema.sql` — seed gán thẳng `user_id` của Kevin. |
| Trang trắng khi F5 trên Vercel | Đã có `frontend/vercel.json` (SPA) — Root Directory phải = `frontend`. |
