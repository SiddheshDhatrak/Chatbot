import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../src/index.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Claude — Maison d'IA",
  description: "A luxurious AI chat salon with persistent history, powered by Groq",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="noir"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <div className="grain min-h-[100dvh]">
          <div className="aurora" aria-hidden />
          {children}
        </div>
      </body>
    </html>
  );
}