'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Eye, EyeOff, Coffee, Loader2, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/components/providers';
import { useToast } from '@/hooks/use-toast';

export default function Auth() {
  const { user, loading, isAdmin, signIn, signUp } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) {
      router.replace(isAdmin ? '/admin' : '/');
    }
  }, [user, loading, isAdmin, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (isLogin) {
        try {
          await signIn(email, password);
          toast({
            title: 'Bienvenido!',
            description: 'Has iniciado sesion correctamente.',
          });
          // Redirect happens automatically via the user check above
        } catch (error: any) {
          toast({
            title: 'Error al iniciar sesion',
            description: error.message === 'Invalid login credentials'
              ? 'Credenciales invalidas. Verifica tu email y contrasena.'
              : error.message,
            variant: 'destructive',
          });
        }
      } else {
        try {
          await signUp(email, password, fullName);
          toast({
            title: 'Registro exitoso!',
            description: 'Revisa tu email para confirmar tu cuenta.',
          });
        } catch (error: any) {
          toast({
            title: 'Error al registrarse',
            description: error.message,
            variant: 'destructive',
          });
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Form */}
      <div className="flex-1 flex items-center justify-center px-4 py-12 bg-background">
        <div className="w-full max-w-md">
          {/* Back to store link */}
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a la tienda
          </Link>

          <div className="text-center mb-8">
            <Image
              src="/assets/logo-kpu.png"
              alt="KPU Cafe"
              width={80}
              height={80}
              className="rounded-full mx-auto mb-4 object-cover"
            />
            <h1 className="font-display text-3xl font-bold text-foreground">
              {isLogin ? 'Iniciar Sesion' : 'Crear Cuenta'}
            </h1>
            <p className="text-muted-foreground mt-2">
              {isLogin
                ? 'Ingresa a tu cuenta KPU Cafe'
                : 'Unete a la familia KPU Cafe'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Nombre completo
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required={!isLogin}
                  placeholder="Juan Perez"
                  className="w-full px-4 py-3 rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="tu@email.com"
                className="w-full px-4 py-3 rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Contrasena
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full btn-kpu flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Coffee className="h-5 w-5" />
              )}
              {isLogin ? 'Iniciar Sesion' : 'Crear Cuenta'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary hover:underline font-medium"
            >
              {isLogin
                ? 'No tienes cuenta? Registrate'
                : 'Ya tienes cuenta? Inicia sesion'}
            </button>
          </div>
        </div>
      </div>

      {/* Right side - Image */}
      <div className="hidden lg:flex flex-1 bg-gradient-coffee items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/50 rounded-full blur-3xl" />
        </div>

        <div className="text-center relative z-10">
          <Coffee className="h-24 w-24 text-primary mx-auto mb-8" />
          <h2 className="font-display text-4xl font-bold text-secondary-foreground mb-4">
            Cafe de Especialidad
          </h2>
          <p className="text-secondary-foreground/80 text-lg max-w-md">
            Desde las montanas del sur de Colombia, el mejor cafe arabica
            directo a tu taza.
          </p>
        </div>
      </div>
    </div>
  );
}
