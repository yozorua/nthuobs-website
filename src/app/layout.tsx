import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "NTHU Observatory", template: "%s — NTHU Observatory" },
  description: "National Tsing Hua University Observatory. Established 1971.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html suppressHydrationWarning>
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
