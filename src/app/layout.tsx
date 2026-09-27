import '../../styles.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'NEXUS RADIO',
  description: 'NEXUS RADIO — музыка, истории и прямой эфир 24/7'
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
