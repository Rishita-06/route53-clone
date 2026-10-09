"use client";
import { BreadcrumbGroupProps } from "@cloudscape-design/components/breadcrumb-group";
import { createContext, useContext, useEffect, useState } from "react";

type Item = BreadcrumbGroupProps.Item;
const Ctx = createContext<{ items: Item[]; set: (i: Item[]) => void }>({ items: [], set: () => {} });

export function BreadcrumbsProvider({ children }: { children: React.ReactNode }) {
  const [items, set] = useState<Item[]>([]);
  return <Ctx.Provider value={{ items, set }}>{children}</Ctx.Provider>;
}
export const useBreadcrumbItems = () => useContext(Ctx).items;

/** Pages declare their breadcrumb trail; the shell renders it in the AppLayout slot. */
export function useBreadcrumbs(items: Item[]) {
  const { set } = useContext(Ctx);
  const key = JSON.stringify(items);
  useEffect(() => { set(items); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [key]);
}
