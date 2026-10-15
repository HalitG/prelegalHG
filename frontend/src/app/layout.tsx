import type { Metadata } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import { AppFooter } from "@/components/AppFooter";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "prelegal", template: "%s · prelegal" },
  description: "Draft common legal agreements from Common Paper standard templates.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${sourceSerif.variable} h-full`}>
      {/* Browser extensions often add attributes to <body> before React hydrates. This only
          silences attribute mismatches on <body> itself, not on anything rendered inside it. */}
      <body className="flex min-h-full flex-col font-sans" suppressHydrationWarning>
        <div className="flex flex-1 flex-col">{children}</div>
        <AppFooter />
      </body>
    </html>
  );
}
