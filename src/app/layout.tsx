import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SendFlow — Bulk WhatsApp Marketing for African SMBs',
  description: 'Reach thousands of customers instantly. Reliable delivery, real-time reports. From $29/month.',
  keywords: 'WhatsApp marketing, bulk messaging, African SMB, Ghana business, WhatsApp business',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
