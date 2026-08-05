import "./globals.css";

export const metadata = {
  title: "Diário de Bordo — Closers",
  description: "Negócios ativos no funil, sincronizados com o HubSpot.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
