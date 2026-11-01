import type { Metadata } from "next";
import { Oswald, Source_Serif_4 } from "next/font/google";
import { ToastProvider } from "@/components/Toast";
import { AuthProvider } from "@/components/Auth";
import "./globals.css";

const oswald = Oswald({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-display" });
const sourceSerif = Source_Serif_4({ subsets: ["latin"], style: ["normal", "italic"], axes: ["opsz"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "Taifa District of SDA",
  description: "Live standings, schedule and rosters for the church games tournament.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${oswald.variable} ${sourceSerif.variable}`}>
      <body>
        <ToastProvider>
          <AuthProvider>{children}</AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
