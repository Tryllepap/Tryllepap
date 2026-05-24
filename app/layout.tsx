import type { Metadata } from "next";
import { Cinzel, IM_Fell_English } from "next/font/google";
import "./globals.css";

const cinzel = Cinzel({
  subsets: ["latin"],
  variable: "--font-cinzel",
  weight: ["400", "600", "700", "900"],
});

const imFell = IM_Fell_English({
  subsets: ["latin"],
  variable: "--font-im-fell",
  weight: "400",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "TryllePap",
  description: "The card game of magic and trickery.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cinzel.variable} ${imFell.variable}`}>
      <body>{children}</body>
    </html>
  );
}
