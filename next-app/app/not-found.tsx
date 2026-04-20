import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="font-display text-6xl font-bold text-primary mb-4">404</h1>
        <p className="text-xl text-muted-foreground mb-8">Pagina no encontrada</p>
        <Link href="/" className="btn-kpu inline-block">Volver al inicio</Link>
      </div>
    </div>
  );
}
