import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'IB Club : comptabilité',
  description: 'Comptabilité en partie double de l\'association IB Club IAE Nice',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
