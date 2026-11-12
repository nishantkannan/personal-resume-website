import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Sans } from "next/font/google";
import { profile } from "@/data/resume";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex",
  display: "swap",
});

function siteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

const description = `${profile.role}. ${profile.tagline}`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: `${profile.name} | ${profile.role}`,
  description,
  authors: [{ name: profile.name }],
  openGraph: {
    title: `${profile.name} | ${profile.role}`,
    description,
    type: "profile",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: `${profile.name} | ${profile.role}`,
    description,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e9eef0" },
    { media: "(prefers-color-scheme: dark)", color: "#1f2b33" },
  ],
};

// Runs before paint so the page never flashes the wrong time of day, theme or layout.
// Time of day: day uses the light theme, dusk and night the dark one.
const themeScript = `(function(){var d=document.documentElement.dataset;try{var t=localStorage.getItem('tod');if(t!=='day'&&t!=='dusk'&&t!=='night'){var old=localStorage.getItem('theme');t=old==='dark'||(old!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches)?'night':'day'}d.tod=t;d.theme=t==='day'?'light':'dark';if(localStorage.getItem('plain')==='1')d.plain='1'}catch(e){d.tod='day';d.theme='light'}})()`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${plex.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
