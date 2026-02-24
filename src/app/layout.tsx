import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/shared/Providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "WhalePunter - Racing Analytics & Whale Bet Tracker",
  description:
    "Track whale bets, live odds fluctuations, and smart money movements on horse racing and greyhound racing via Betfair Exchange.",
  keywords: ["horse racing", "greyhound racing", "betting analytics", "Betfair", "whale bets", "odds tracker"],
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
