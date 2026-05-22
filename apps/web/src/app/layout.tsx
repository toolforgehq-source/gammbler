import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gammbler — Every Bettor Gets a Score",
  description: "Your betting reputation, ranked. Compete on national leaderboards, challenge your friends, and share your Gammbler Score on social media.",
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
