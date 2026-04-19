import "./globals.css";

export const metadata = {
  title: "Atölye İzin Sistemi",
  description: "TOFAŞ Fen Lisesi İnovasyon Atölyesi izin otomasyonu",
};

export default function RootLayout({ children }) {
  return (
    <html lang="tr">
      <body
        className="min-h-screen bg-charcoal-900 text-gray-100"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
