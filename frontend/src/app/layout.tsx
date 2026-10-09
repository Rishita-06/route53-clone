import "@cloudscape-design/global-styles/index.css";
import "./globals.css";
import type { Metadata } from "next";
import { AuthProvider } from "@/lib/auth";
import { NotificationProvider } from "@/lib/notifications";

export const metadata: Metadata = { title: "Route 53 Management Console", description: "Route 53 console clone" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <NotificationProvider>{children}</NotificationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
