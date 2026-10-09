"use client";
import { applyMode, Mode } from "@cloudscape-design/global-styles";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

/** onFollow handler that does client-side navigation instead of a full page load. */
export function useFollow() {
  const router = useRouter();
  return useCallback((e: { detail: { href?: string; external?: boolean }; preventDefault: () => void }) => {
    if (e.detail.external || !e.detail.href) return;
    e.preventDefault();
    router.push(e.detail.href);
  }, [router]);
}

export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

export function useDarkMode(): [boolean, (v: boolean) => void] {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const d = window.localStorage.getItem("r53_dark") === "1";
    setDark(d); applyMode(d ? Mode.Dark : Mode.Light);
  }, []);
  return [dark, (v) => { setDark(v); window.localStorage.setItem("r53_dark", v ? "1" : "0"); applyMode(v ? Mode.Dark : Mode.Light); }];
}

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
