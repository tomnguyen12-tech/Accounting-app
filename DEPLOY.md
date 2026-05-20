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

Mở **http://localhost:5173** → nhập email của một profile có trong bảng `users`
(xem Bước 1 — bạn tự chọn email khi seed) → bấm **로그인 / Sign in**.

> ⚠️ Demo mode: mật khẩu **không được kiểm tra**, chỉ cần email khớp 1 dòng trong
> bảng `users`. Vì vậy **không nên đẩy email login lên repo public**. Muốn an toàn
> thật thì bật lại Supabase Auth (xem lịch sử commit trước đây).

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
