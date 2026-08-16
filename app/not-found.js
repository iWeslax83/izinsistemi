import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg px-6 text-center text-ink">
      <h1 className="text-4xl font-semibold">404</h1>
      <p className="text-ink/70">Aradığınız sayfa bulunamadı.</p>
      <Link href="/" className="underline underline-offset-4">
        Ana sayfaya dön
      </Link>
    </main>
  );
}
