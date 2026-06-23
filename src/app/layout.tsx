import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Brilla Operations System",
  description: "Configurable field-service operations platform for Brilla Services",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
