import type { Metadata } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import "@ecomm/storefront/styles.css";

const display = Fraunces({ subsets: ["latin"], variable: "--font-display" });
const sans = Source_Sans_3({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "BSV Hats · BigCommerce",
  description: "Offline Pay with BSV method and order confirmation payment.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
