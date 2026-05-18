import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { AuthUser } from "@/types";

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx>(null!);
const KEY = "demo_user";

/**
 * DEMO MODE — no Supabase Auth / no email confirmation.
 * "Login" simply looks up a seeded profile by email (password not enforced).
 * Data access works because RLS is open to the publishable key.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      try {
        setUser(JSON.parse(raw));
      } catch {
        localStorage.removeItem(KEY);
      }
    }
    setLoading(false);
  }, []);

  const login = async (email: string, _password: string) => {
    const { data, error } = await supabase
      .from("users")
      .select("id,email,name,role")
      .eq("email", email.trim().toLowerCase())
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data)
      throw new Error(
        "Tài khoản không tồn tại. Bạn đã chạy supabase/schema.sql chưa?",
      );
    const u: AuthUser = data as AuthUser;
    localStorage.setItem(KEY, JSON.stringify(u));
    setUser(u);
  };

  const logout = () => {
    localStorage.removeItem(KEY);
    setUser(null);
    location.href = "/login";
  };

  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
