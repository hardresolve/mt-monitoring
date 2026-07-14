import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'

export const metadata: Metadata = {
  title: 'MT Monitoring System',
  description: 'SANHS',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <Script src="/feedback-widget.js" strategy="afterInteractive" />
      </body>
    </html>
  )
}
