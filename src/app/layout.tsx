import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from 'react-hot-toast';
import AuthProvider from '@/components/AuthProvider';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ReqAssist — MSc Thesis Research",
  description:
    "AI-assisted software requirements gathering: analyse documents, refine by conversation, and export structured specifications.",
  // Participant-facing study site; keep it out of search results.
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AuthProvider>
          {children}
          {/* Toasts inherit the theme tokens so they match in light and dark. */}
          <Toaster
            position="top-center"
            toastOptions={{
              style: {
                background: 'var(--surface)',
                color: 'var(--ink)',
                border: '1px solid var(--line)',
                borderRadius: '0.75rem',
                fontSize: '13px',
                boxShadow: '0 4px 16px rgb(0 0 0 / 0.08)',
              },
              success: { iconTheme: { primary: 'var(--positive)', secondary: 'var(--surface)' } },
              error: { iconTheme: { primary: 'var(--critical)', secondary: 'var(--surface)' } },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
