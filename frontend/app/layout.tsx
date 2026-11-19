import type { Metadata } from "next";
import { Albert_Sans, JetBrains_Mono, Saira_Condensed } from "next/font/google";
import { ToastProvider } from "@/components/Toast";
import { AuthProvider } from "@/components/Auth";
import "./globals.css";

// Sport theme faces. The variables feed the font tokens in tokens.css.
const display = Saira_Condensed({ subsets: ["latin"], weight: ["800"], display: "swap", variable: "--nf-display" });
const body = Albert_Sans({ subsets: ["latin"], weight: ["400", "500"], display: "swap", variable: "--nf-body" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["500"], display: "swap", variable: "--nf-mono" });

export const metadata: Metadata = {
  title: "Taifa District of SDA",
  description: "Live standings, schedule and rosters for the church games tournament.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <ToastProvider>
          <AuthProvider>{children}</AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
