import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Reliquary Miner Dashboard',
  description: 'Live submission status for a Bittensor subnet 81 miner.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
