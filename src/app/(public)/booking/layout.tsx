import type { Metadata } from "next"
import { Geist } from "next/font/google"
import "../../globals.css"
import { Toaster } from "@/components/ui/toaster"
import { BookingApp } from "./booking-app"

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Book Online — Care Diagnostic Centre",
  description: "Book diagnostic tests and health packages online. Secure payment via ICICI Orange Pay.",
}

export default function BookingLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
