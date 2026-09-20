import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "UniMedi — Unified Smart Healthcare & Consultation Platform",
  description:
    "Next-generation digital health platform enabling seamless doctor appointments, QR walk-in consultations, structured electronic prescriptions, and secure medical records.",
  keywords: [
    "healthcare",
    "telemedicine",
    "doctor appointments",
    "medical records",
    "QR consultation",
    "digital prescription",
  ],
  authors: [{ name: "UniMedi Health Systems" }],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#4f46e5",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans min-h-screen flex flex-col bg-slate-50 text-slate-900 antialiased selection:bg-indigo-500 selection:text-white`}
      >
        {children}
      </body>
    </html>
  );
}
