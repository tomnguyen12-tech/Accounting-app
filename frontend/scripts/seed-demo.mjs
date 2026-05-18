// One-shot demo seeder — talks to Supabase via the publishable key in
// frontend/.env. Idempotent: clears the 8 tables then re-inserts.
// Run:  cd frontend && node scripts/seed-demo.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const here = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(join(here, "..", ".env"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);
const URL = env.VITE_SUPABASE_URL;
const KEY = env.VITE_SUPABASE_ANON_KEY;
if (!URL || !KEY) throw new Error("Thiếu VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY trong frontend/.env");
const sb = createClient(URL, KEY);

const UID = {
  admin: "11111111-1111-1111-1111-111111111111",
  acct: "22222222-2222-2222-2222-222222222222",
  kevin: "33333333-3333-3333-3333-333333333333",
  sora: "44444444-4444-4444-4444-444444444444",
};

function splitAmount(total, n) {
  const base = Math.floor(total / n / 100) * 100;
  const parts = [];
  let running = 0;
  for (let i = 0; i < n - 1; i++) {
    const v = Math.max(5000, base + (((i % 5) - 2) * 5000));
    parts.push(v);
    running += v;
  }
  parts.push(total - running);
  return parts;
}

const die = (label, error) => {
  if (error) {
    console.error(`✗ ${label}:`, error.message ?? error);
    process.exit(1);
  }
};

async function wipe() {
  // FK-safe order. PostgREST needs a filter, so match-all per pk type.
  const byBig = ["review_logs", "transactions", "import_jobs", "receipt_files", "corporate_cards", "category_rules"];
  for (const t of byBig) {
    const { error } = await sb.from(t).delete().gt("id", 0);
    if (error && !/does not exist/i.test(error.message)) die(`wipe ${t}`, error);
  }
  let r = await sb.from("users").delete().neq("email", "__none__");
  if (r.error && !/does not exist/i.test(r.error.message)) die("wipe users", r.error);
  r = await sb.from("departments").delete().gt("id", 0);
  if (r.error && !/does not exist/i.test(r.error.message)) die("wipe departments", r.error);
}

async function main() {
  console.log(`Seeding ${URL} …`);
  await wipe();

  const { data: deps, error: de } = await sb
    .from("departments")
    .insert([{ name: "Sales" }, { name: "Engineering" }, { name: "Marketing" }])
    .select("id,name");
  die("departments", de);
  const dep = (n) => deps.find((d) => d.name === n)?.id ?? null;

  die(
    "users",
    (
      await sb.from("users").insert([
        { id: UID.admin, email: "admin@demo.io", name: "Admin", role: "ADMIN" },
        { id: UID.acct, email: "acct@demo.io", name: "Accountant", role: "ACCOUNTANT" },
        { id: UID.kevin, email: "kevin@demo.io", name: "Kevin", role: "USER", department_id: dep("Sales") },
        { id: UID.sora, email: "sora@demo.io", name: "Sora", role: "USER", department_id: dep("Engineering") },
      ])
    ).error,
  );

  const { data: cards, error: ce } = await sb
    .from("corporate_cards")
    .insert([
      {
        card_number_masked: "4835-****-****-7498",
        last4: "7498",
        issuer: "Shinhan Card",
        holder_user_id: UID.kevin,
        department_id: dep("Sales"),
      },
      {
        card_number_masked: "5210-****-****-1043",
        last4: "1043",
        issuer: "Hyundai Card",
        department_id: dep("Engineering"),
      },
    ])
    .select("id,card_number_masked");
  die("cards", ce);
  const kevinCard = cards.find((c) => c.card_number_masked === "4835-****-****-7498").id;

  const rules = [];
  const add = (arr, cat, pri = 10) => arr.forEach((k) => rules.push({ keyword: k, category: cat, priority: pri }));
  add(["티머니", "택시", "주차", "렌트카", "주유소", "카카오택시", "버스", "지하철"], "교통");
  add(["커피", "카페", "스타벅스", "투썸", "커피빈", "식당", "치킨", "횟집", "비어", "김밥", "베이커리"], "식음료");
  add(["호텔", "숙박", "제주", "리조트", "항공"], "숙박/여행");
  add(["AWS", "Google", "Microsoft", "Naver Cloud", "Adobe"], "소프트웨어");
  add(["문구", "사무용품", "모니터", "키보드", "마우스", "다이소"], "사무용품");
  add(["CGV", "메가박스", "골프", "스크린"], "레저", 20);
  die("category_rules", (await sb.from("category_rules").insert(rules)).error);

  const plan = [
    { c: "식음료", t: 2916250, n: 22, m: ["텀블러비어역삼직영점", "스타벅스역삼점", "투썸플레이스강남", "커피빈선릉", "교촌치킨역삼", "노량진수산횟집", "김밥천국", "이디야커피"] },
    { c: "숙박/여행", t: 1585000, n: 6, m: ["제주신라호텔", "롯데호텔서울", "한화리조트제주"] },
    { c: "레저", t: 1074000, n: 8, m: ["CGV강남", "골프존역삼", "스크린골프"] },
    { c: "교통", t: 440900, n: 11, m: ["카카오택시", "티머니교통", "GS칼텍스주유소", "강남공영주차장"] },
    { c: "기타", t: 42000, n: 2, m: ["다이소역삼점", "무인양품"] },
  ];
  const txs = [];
  let created = 0;
  for (const p of plan) {
    const amounts = splitAmount(p.t, p.n);
    for (let i = 0; i < amounts.length; i++) {
      const amt = amounts[i];
      const day = Math.min(((created * 3) % 31) + 1, 31);
      const date = `2026-03-${String(day).padStart(2, "0")}`;
      const needs = created % 9 === 0;
      txs.push({
        user_id: UID.kevin,
        department_id: dep("Sales"),
        card_id: kevinCard,
        transaction_date: date,
        approval_date: date,
        payment_date: "2026-04-15",
        card_number_masked: "4835-****-****-7498",
        approval_number: String(30000000 + created * 137 + 19),
        merchant_name: p.m[i % p.m.length],
        merchant_number: String(94586000 + created),
        amount: amt,
        vat_amount: Math.round(amt / 11),
        category: p.c,
        source_type: "EXCEL",
        confidence_score: needs ? 0.55 : 0.92,
        status: needs ? "NEEDS_REVISION" : "AI_EXTRACTED",
      });
      created++;
    }
  }
  die("transactions", (await sb.from("transactions").insert(txs)).error);

  const { count: uc } = await sb.from("users").select("*", { count: "exact", head: true });
  const { data: ksum } = await sb.from("transactions").select("amount").eq("user_id", UID.kevin);
  const total = (ksum ?? []).reduce((a, r) => a + Number(r.amount), 0);
  console.log(`✓ Done. users=${uc}, Kevin txns=${ksum?.length}, total=${total.toLocaleString()}원`);
  console.log(`  (kỳ vọng: users=4, Kevin txns=49, total=6,058,150원)`);
}

main();
