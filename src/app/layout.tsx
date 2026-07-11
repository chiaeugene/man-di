import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { getServerLocale } from "@/lib/i18n/server";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mandy — AI Photography Sales Coordinator",
  description:
    "Mandy replies, qualifies, recommends packages, and books weddings for photographers — automatically.",
  openGraph: {
    title: "Mandy — AI Photography Sales Coordinator",
    description:
      "Mandy replies, qualifies, recommends packages, and books weddings for photographers — automatically.",
    type: "website",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getServerLocale();

  return (
    <html lang={locale} className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900 font-sans">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-wine focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-petal"
        >
          Skip to content
        </a>
        <LocaleProvider initialLocale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
