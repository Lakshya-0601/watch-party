import type { Metadata } from "next";
import { Bebas_Neue, Geist } from "next/font/google";
import { ExtensionBridge } from "@/components/ExtensionBridge";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Condensed display face for the cinematic headings
const bebas = Bebas_Neue({
  variable: "--font-bebas",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "ReelRoom — Watch together", template: "%s · ReelRoom" },
  description: "Real-time watch parties with synchronized playback and shared movie discovery.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${bebas.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <ExtensionBridge />
      </body>
    </html>
  );
}
