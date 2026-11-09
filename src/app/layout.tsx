import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Quizcrafter",
  description: "The team quiz with fresh AI questions every game.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#04071a",
};

const SPECKS = Array.from({ length: 12 }, (_, i) => ({
  left: `${(i * 37 + 5) % 100}%`,
  top: `${100 + ((i * 13) % 20)}%`,
  duration: `${18 + ((i * 7) % 14)}s`,
  delay: `${-((i * 5) % 24)}s`,
}));

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${outfit.variable} antialiased`}>
        <div className="rings" aria-hidden>
          <span />
          <span />
          <span />
          {SPECKS.map((f, i) => (
            <i key={i} style={{ left: f.left, top: f.top, animationDuration: f.duration, animationDelay: f.delay }} />
          ))}
        </div>
        <main className="relative z-10 mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
