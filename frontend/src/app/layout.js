import "./globals.css"
import { Inter, Space_Grotesk } from "next/font/google"

const inter = Inter({ subsets: ["latin"], display: "swap" })
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-display", display: "swap" })

export const metadata = {
  title: "RCCIIT Chatbot",
  description: "A modern chatbot interface for RCCIIT student information",
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${inter.className} ${spaceGrotesk.variable}`}>{children}</body>
    </html>
  )
}
