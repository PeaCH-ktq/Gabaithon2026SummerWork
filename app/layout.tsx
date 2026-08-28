import type { Metadata } from "next";
import { Noto_Sans_JP, Outfit } from "next/font/google";
import "./globals.css";

const noto = Noto_Sans_JP({ variable: "--font-jp", subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });
const outfit = Outfit({ variable: "--font-display", subsets: ["latin"], weight: ["500", "600", "700"] });

export const metadata: Metadata = {
  title: "Tan-E｜単位取得を、ひとりにしない。",
  description: "講義資料から問題をつくり、仲間と学習予定を共有できる大学生向け学習支援アプリ。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ja"
      className={`${noto.variable} ${outfit.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}

