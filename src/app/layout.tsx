import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Finance control centre",
  description: "Private local cash-flow planning",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body>{children}</body>
    </html>
  );
}
