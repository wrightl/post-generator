import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import { Providers } from "@/components/Providers";
import { Nav } from "@/components/Nav";
import "./globals.css";

const dmSans = DM_Sans({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Post Generator",
  description: "AI-powered social media post scheduler",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${dmSans.className} min-h-screen bg-[var(--bg)] text-[var(--text)] antialiased`}>
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        <Providers>
          <Nav />
          <div className="min-h-[calc(100vh-56px)]">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
