import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'Private Dining Finder',
  description: 'Find venues that can actually host your group.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
