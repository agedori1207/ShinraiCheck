import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ShinraiCheck | 情報の信頼性を確認",
  description: "公開ソースを比較し、情報の信頼性と判定理由を透明に表示します。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
