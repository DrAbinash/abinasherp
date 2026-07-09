import type { Metadata } from "next"
import { Geist } from "next/font/google"
import "../../globals.css"
import { Toaster } from "@/components/ui/toaster"
import { PortalApp } from "./portal-app"

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Patient Portal — Care Diagnostic Centre",
  description: "View reports, bills, book appointments. Secure OTP login.",
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
