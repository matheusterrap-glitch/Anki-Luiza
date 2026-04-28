import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cards para Concurso - Luiza",
  description: "Sistema de Flashcards Inteligente",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased bg-zinc-50 text-zinc-900 min-h-screen">
        {children}
      </body>
    </html>
  );
}
