import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button, Card, CardBody, Input, Label } from "@/components/ui";

const DEMO = [
  { role: "Admin", email: "admin@demo.io", pw: "admin123" },
  { role: "Accountant", email: "acct@demo.io", pw: "acct123" },
  { role: "User · Kevin", email: "kevin@demo.io", pw: "kevin123" },
];

export default function Login() {
  const { login, signup } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("kevin@demo.io");
  const [password, setPassword] = useState("kevin123");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "signup") await signup(email, password);
      else await login(email, password);
      navigate("/");
    } catch (err: any) {
      setError(err.message ?? (mode === "signup" ? "Sign up failed" : "Login failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-brand-50 to-teal-50 px-4">
      <Card className="w-full max-w-md">
        <CardBody className="p-8">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-teal-500 text-xl font-bold text-white">
              E
            </div>
            <h1 className="text-xl font-bold">Expense Assistant</h1>
            <p className="text-sm text-slate-500">
              AI 법인카드 경비 관리 · {mode === "signup" ? "계정 만들기" : "로그인"}
            </p>
          </div>
          <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 text-sm">
            <button
              onClick={() => setMode("login")}
              className={`rounded-lg py-1.5 font-medium ${
                mode === "login" ? "bg-white shadow-sm text-brand-600" : "text-slate-500"
              }`}
            >
              로그인 / Sign in
            </button>
            <button
              onClick={() => setMode("signup")}
              className={`rounded-lg py-1.5 font-medium ${
                mode === "signup" ? "bg-white shadow-sm text-brand-600" : "text-slate-500"
              }`}
            >
              계정 만들기 / Sign up
            </button>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label>이메일 / Email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
            </div>
            <div>
              <Label>비밀번호 / Password</Label>
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
              />
            </div>
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <Button className="w-full" disabled={busy}>
              {busy
                ? "처리 중…"
                : mode === "signup"
                  ? "계정 만들기 / Sign up"
                  : "로그인 / Sign in"}
            </Button>
          </form>
          <div className="mt-6 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
            <p className="mb-1 font-medium text-slate-600">
              데모 계정 — 최초 1회 "계정 만들기"로 가입 후 로그인
            </p>
            {DEMO.map((d) => (
              <button
                key={d.email}
                onClick={() => {
                  setEmail(d.email);
                  setPassword(d.pw);
                }}
                className="block w-full text-left hover:text-brand-600"
              >
                {d.role} — {d.email} / {d.pw}
              </button>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
