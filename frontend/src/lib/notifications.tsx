"use client";
import { FlashbarProps } from "@cloudscape-design/components/flashbar";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

type Item = FlashbarProps.MessageDefinition;
interface Ctx { items: Item[]; notify: (type: "success" | "error" | "info" | "warning", content: React.ReactNode, header?: string) => void }
const NotificationCtx = createContext<Ctx>(null as never);
export const useNotifications = () => useContext(NotificationCtx);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const dismiss = useCallback((id: string) => setItems((xs) => xs.filter((x) => x.id !== id)), []);

  const notify = useCallback<Ctx["notify"]>((type, content, header) => {
    const id = Math.random().toString(36).slice(2);
    setItems((xs) => [...xs.slice(-2), { id, type, content, header, dismissible: true, onDismiss: () => dismiss(id) }]);
    if (type !== "error") setTimeout(() => dismiss(id), 8000);
  }, [dismiss]);

  const value = useMemo(() => ({ items, notify }), [items, notify]);
  return <NotificationCtx.Provider value={value}>{children}</NotificationCtx.Provider>;
}
