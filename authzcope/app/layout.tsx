import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { DatabaseConnectionProvider } from "@/components/database-connection-provider";
import { AiConnectionProvider } from "@/components/ai-connection-provider";
import { AnalysisProvider } from "@/components/analysis-provider";
import { ExplorerNavigationProvider } from "@/components/explorer-navigation-provider";
import { getAiConfigurationStatus } from "@/lib/ai-connection";
import { getConfigurationStatus } from "@/lib/introspection";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "AuthZcope",
    template: "%s | AuthZcope",
  },
  description:
    "Understand application authorization through domain intent, database policies, and evidence.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <DatabaseConnectionProvider configured={getConfigurationStatus().databaseConfigured}>
          <AiConnectionProvider configuration={getAiConfigurationStatus()}>
            {/* A transport migration must discard stores retained by Fast Refresh. */}
            <AnalysisProvider key="analysis-stream-v2"><ExplorerNavigationProvider><AppShell>{children}</AppShell></ExplorerNavigationProvider></AnalysisProvider>
          </AiConnectionProvider>
        </DatabaseConnectionProvider>
      </body>
    </html>
  );
}
