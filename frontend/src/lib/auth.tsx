"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, setUnauthorizedHandler, tokenStore } from "./api";
import type { User } from "./types";

type Status = "loading" | "authenticated" | "anonymous";
interface AuthCtx {
  status: Status; user: User | null;
  signIn: (accountId: string, username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}
const Ctx = createContext<AuthCtx>(null as never);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<User | null>(null);

  const reset = useCallback(() => { tokenStore.clear(); setUser(null); setStatus("anonymous"); }, []);

  // Session persistence: restore from the stored token on first load.
  useEffect(() => {
    setUnauthorizedHandler(reset);
    if (!tokenStore.get()) { setStatus("anonymous"); return; }
    api.me().then((u) => { setUser(u); setStatus("authenticated"); }).catch(reset);
    return () => setUnauthorizedHandler(null);
  }, [reset]);

  const value = useMemo<AuthCtx>(() => ({
    status, user,
    signIn: async (a, u, p) => {
      const res = await api.login(a, u, p);
      tokenStore.set(res.token); setUser(res.user); setStatus("authenticated");
    },
    signOut: async () => { try { await api.logout(); } catch { /* ignore */ } reset(); },
  }), [status, user, reset]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
