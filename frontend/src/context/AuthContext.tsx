import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { AuthUser } from "@/types";

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx>(null!);

async function loadProfile(): Promise<AuthUser | null> {
  const { data: sess } = await supabase.auth.getSession();
  const authUser = sess.session?.user;
  if (!authUser) return null;
  const { data: profile } = await supabase
    .from("users")
    .select("id,email,name,role")
    .eq("id", authUser.id)
    .single();
  return (
    profile ?? {
      id: authUser.id,
      email: authUser.email ?? "",
      name: authUser.email?.split("@")[0] ?? "User",
      role: "USER",
    }
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile()
      .then(setUser)
      .finally(() => setLoading(false));
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      loadProfile().then(setUser);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    setUser(await loadProfile());
  };

  const signup = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw new Error(error.message);
    // If email confirmation is disabled, a session is created immediately.
    setUser(await loadProfile());
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    location.href = "/login";
  };

  return (
    <Ctx.Provider value={{ user, loading, login, signup, logout }}>{children}</Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
