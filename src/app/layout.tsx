import type { Metadata } from "next";
import { Inter, Noto_Sans_TC } from 'next/font/google';
import "./globals.css";

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const notoSansTC = Noto_Sans_TC({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-noto-tc',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: "NTHU Observatory", template: "%s — NTHU Observatory" },
  description: "National Tsing Hua University Observatory. Established 1971.",
  icons: {
    icon: [
      { url: '/icons/dark-32.png',  sizes: '32x32',   type: 'image/png', media: '(prefers-color-scheme: light)' },
      { url: '/icons/dark-96.png',  sizes: '96x96',   type: 'image/png', media: '(prefers-color-scheme: light)' },
      { url: '/icons/white-32.png', sizes: '32x32',   type: 'image/png', media: '(prefers-color-scheme: dark)' },
      { url: '/icons/white-96.png', sizes: '96x96',   type: 'image/png', media: '(prefers-color-scheme: dark)' },
    ],
    shortcut: '/icons/dark-favicon.ico',
    apple: [
      { url: '/icons/dark-180.png',  sizes: '180x180', type: 'image/png', media: '(prefers-color-scheme: light)' },
      { url: '/icons/white-180.png', sizes: '180x180', type: 'image/png', media: '(prefers-color-scheme: dark)' },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html className={`${inter.variable} ${notoSansTC.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
