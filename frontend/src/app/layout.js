import "./globals.css"
import { Inter, Space_Grotesk } from "next/font/google"

const inter        = Inter({ subsets: ["latin"], display: "swap" })
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-display", display: "swap" })

export const metadata = {
  title: "RCCIIT Chatbot",
  description: "AI-powered student assistant for RCCIIT — admissions, exams, campus services, and more.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "RCCIIT Bot" },
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#002045",
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.className} ${spaceGrotesk.variable}`}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/college-logo.PNG" />
      </head>
      <body>{children}</body>
    </html>
  )
}
