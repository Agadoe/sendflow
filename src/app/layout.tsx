import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SendFlow — Bulk WhatsApp Marketing for African SMBs',
  description: 'Reach thousands of customers instantly. Schedule campaigns, automate follow-ups, and track every message — from one dashboard. From GHS 299/month.',
  keywords: 'WhatsApp marketing, bulk messaging, African SMB, Ghana business, WhatsApp business, drip sequences, campaign automation',
  openGraph: {
    title: 'SendFlow — Bulk WhatsApp Marketing for African SMBs',
    description: 'Reach thousands of customers instantly. Schedule campaigns, automate follow-ups, and track every message.',
    type: 'website',
    locale: 'en_GH',
    url: 'https://sendflow-two.vercel.app',
    siteName: 'SendFlow',
    images: [
      {
        url: 'https://sendflow-two.vercel.app/og-image.png',
        width: 1200,
        height: 630,
        alt: 'SendFlow — WhatsApp marketing dashboard for African businesses',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SendFlow — Bulk WhatsApp Marketing for African SMBs',
    description: 'Reach thousands of customers instantly. Schedule campaigns, automate follow-ups, and track every message.',
    images: ['https://sendflow-two.vercel.app/og-image.png'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="manifest" href="/site.webmanifest" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
