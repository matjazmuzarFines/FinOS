import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { ANIMACIJE_SKRIPTA } from "@/lib/animacijeSkripta";
import { Seja } from "@/components/Seja";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
});

// Pisava za napis FIN:OS in velike naslove
const display = Space_Grotesk({
  variable: "--font-grotesk",
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "FIN:OS",
  description: "FIN:OS - Fines Operating System. Notranje vodenje podjetja FINES d.o.o.",
};

export const viewport: Viewport = {
  themeColor: "#121214",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="sl" className={`${inter.variable} ${display.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: ANIMACIJE_SKRIPTA }} />
      </head>
      <body className="min-h-full overflow-x-clip">
        <Seja>{children}</Seja>
      </body>
    </html>
  );
}
