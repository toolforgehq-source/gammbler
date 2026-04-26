import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gammbler — Know Your Edge",
  description: "The world's first unified sports betting identity and analytics platform.",
  icons: {
    icon: "/images/logo-icon.png",
    apple: "/images/logo-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
