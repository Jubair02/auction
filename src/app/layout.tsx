import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_Bengali } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Bangla UI: Geist has no Bengali glyphs, so this is the fallback for them.
const notoBengali = Noto_Sans_Bengali({
  variable: "--font-bengali",
  subsets: ["bengali"],
  weight: ["400", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NeelamGhor — Live Player Auctions for Bangladesh",
  description: "Create tournaments, add players, build teams and run live room-code based player auctions with automatic budgets and squads. ৳ BDT, Cricket & Football.",
  keywords: ["player auction", "cricket auction", "football auction", "Bangladesh", "tournament", "NeelamGhor"],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "NeelamGhor — Live Player Auctions",
    description: "Run live player auctions for your local tournament in minutes.",
    siteName: "NeelamGhor",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${notoBengali.variable} antialiased bg-background text-foreground`}
      >
        {children}
      </body>
    </html>
  );
}
