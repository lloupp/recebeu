import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Recebeu",
  description: "Contas a receber sem complicação.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
