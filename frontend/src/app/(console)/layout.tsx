"use client";
import Spinner from "@cloudscape-design/components/spinner";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ConsoleShell } from "@/components/ConsoleShell";
import { useAuth } from "@/lib/auth";
import { BreadcrumbsProvider } from "@/lib/breadcrumbs";

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  useEffect(() => { if (status === "anonymous") router.replace("/login"); }, [status, router]);

  if (status !== "authenticated") {
    return <div style={{ padding: 40, textAlign: "center" }}><Spinner size="large" /></div>;
  }
  return (
    <BreadcrumbsProvider>
      <ConsoleShell>{children}</ConsoleShell>
    </BreadcrumbsProvider>
  );
}
