import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono, Noto_Sans_Bengali } from "next/font/google";
import { LANG_COOKIE, parseLang } from "@/lib/lang-cookie";
import { SYSTEM_THEME_SCRIPT, THEME_COOKIE, parseTheme } from "@/lib/theme-cookie";
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
  // Four weights are a large download; without preload the browser fetches
  // them only when Bangla text actually appears on the page.
  preload: false,
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
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${notoBengali.variable} antialiased bg-background text-foreground`}
      >
        {children}
      </body>
    </html>
  );
}
