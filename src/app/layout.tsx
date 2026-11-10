import type { Metadata, Viewport } from "next";
import { Geist, Newsreader } from "next/font/google";
import "../../tokens.css";
import "./globals.css";

const newsreader = Newsreader({ variable: "--font-newsreader", subsets: ["latin"], axes: ["opsz"] });
const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AI Trend Tracker: what is rising in AI this week",
  description:
    "A weekly reading of where attention in artificial intelligence is moving, measured from research papers, open-source code, model releases and news discussion.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${newsreader.variable} ${geist.variable}`}>
      <body>{children}</body>
    </html>
  );
}
