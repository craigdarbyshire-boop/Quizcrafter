import type { Metadata, Viewport } from "next";
import { Fredoka } from "next/font/google";
import "./globals.css";

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Quizcrafter",
  description: "A team quiz game for the whole family, with fresh AI questions every time.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#120a3a",
};

const FLOATERS = Array.from({ length: 14 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  top: `${100 + ((i * 13) % 20)}%`,
  duration: `${14 + ((i * 7) % 12)}s`,
  delay: `${-((i * 5) % 20)}s`,
  color: ["#ff4fa3", "#ffd23f", "#3ce8b0", "#3ec7ff", "#9b6bff"][i % 5],
}));

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${fredoka.variable} antialiased`}>
        <div className="rings" aria-hidden>
          <span />
          <span />
          <span />
          {FLOATERS.map((f, i) => (
            <i key={i} style={{ left: f.left, top: f.top, animationDuration: f.duration, animationDelay: f.delay, background: f.color }} />
          ))}
        </div>
        <main className="relative z-10 mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
