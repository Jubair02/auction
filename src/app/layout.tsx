import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import { LANG_COOKIE, parseLang } from "@/lib/lang-cookie";
import { SYSTEM_THEME_SCRIPT, THEME_COOKIE, parseTheme } from "@/lib/theme-cookie";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Bangla UI: Geist has no Bengali glyphs, so this is the fallback for them.
// Self-hosted (Google's variable Noto Sans Bengali, Bengali subset, v33, OFL),
// not next/font/google: Google sometimes answers build servers with
// `/l/font?kit=…` URLs that next/font cannot parse, which failed the Vercel
// build. One variable file covers every weight.
const notoBengali = localFont({
  src: "./fonts/noto-sans-bengali-var.woff2",
  variable: "--font-bengali",
  weight: "100 900",
  display: "swap",
  // Fetched only when Bangla text (or ৳) is on the page: not preloaded, and
  // limited to the Bengali block like Google's own subset.
  preload: false,
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0951-0952, U+0964-0965, U+0980-09FE, U+1CD0, U+1CD2, U+1CD5-1CD6, U+1CD8, U+1CE1, U+1CEA, U+1CED, U+1CF2, U+1CF5-1CF7, U+200C-200D, U+20B9, U+25CC, U+A8F1, U+11DF0-11DF1",
    },
  ],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  applicationName: "NeelamGhor",
  title: "NeelamGhor — Live Player Auctions for Bangladesh",
  description: "Create tournaments, add players, build teams and run live room-code based player auctions with automatic budgets and squads. ৳ BDT, Cricket & Football.",
  keywords: ["player auction", "cricket auction", "football auction", "Bangladesh", "tournament", "NeelamGhor"],
  icons: {
    icon: { url: "/favicon.svg", type: "image/svg+xml" },
    // iOS home screen / Safari don't use SVG favicons.
    apple: { url: "/apple-touch-icon.png", sizes: "180x180" },
  },
  // The web app manifest comes from src/app/manifest.ts (Next adds its <link>).
  // iOS reads these instead: home-screen title, full-screen launch.
  appleWebApp: {
    capable: true,
    title: "NeelamGhor",
    statusBarStyle: "default",
  },
  openGraph: {
    title: "NeelamGhor — Live Player Auctions",
    description: "Run live player auctions for your local tournament in minutes.",
    siteName: "NeelamGhor",
    type: "website",
  },
};

// Brand teal (--primary in globals.css) for the browser / installed-app title
// bar; a deep teal-black when the device is in dark mode.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0f766e" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1716" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jar = await cookies();
  // Same cookie the page renders its text from, so <html lang> matches it.
  const lang = parseLang(jar.get(LANG_COOKIE)?.value);
  // A saved light/dark choice is rendered by the server; "system" is decided
  // by the device, so a tiny script sets it before the first paint.
  const theme = parseTheme(jar.get(THEME_COOKIE)?.value);
  return (
    <html
      lang={lang}
      className={theme === "dark" ? "dark" : undefined}
      style={theme === "system" ? undefined : { colorScheme: theme }}
      suppressHydrationWarning
    >
      <head>
        {theme === "system" ? <script dangerouslySetInnerHTML={{ __html: SYSTEM_THEME_SCRIPT }} /> : null}
      </head>
      {/* Browser extensions (e.g. Grammarly's data-gr-* attributes) edit <body> before
          React loads. This ignores attribute differences on <body> only — one level
          deep, so real mismatches in the app below are still reported. */}
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${notoBengali.variable} antialiased bg-background text-foreground`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
