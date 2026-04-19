import type { Metadata } from 'next';
import { Inter, DM_Serif_Display, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const dmSerif = DM_Serif_Display({ weight: ['400'], style: ['normal', 'italic'], subsets: ['latin'], variable: '--font-dm-serif' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains' });

export const metadata: Metadata = {
  title: 'SendFlow — Bulk WhatsApp Marketing for African SMBs',
  description: 'Reach thousands of customers instantly. Reliable delivery, real-time reports. From $29/month.',
  keywords: 'WhatsApp marketing, bulk messaging, African SMB, Ghana business, WhatsApp business',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${dmSerif.variable} ${jetbrainsMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
