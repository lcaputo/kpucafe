'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers';
import { useCardPayment } from '@/hooks/useCardPayment';
import CardForm, { CardTokenResult } from '@/components/CardForm';
import Header from '@/components/header';
import Footer from '@/components/footer';
import { CreditCard, Trash2, Star, Plus, Loader2, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function MisMetodosDePago() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { savedMethods, loadingMethods, fetchMethods, saveCard, deleteMethod, setDefault } = useCardPayment();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth');
  }, [authLoading, user, router]);

  useEffect(() => {
    if (user) fetchMethods();
  }, [user]);

  const handleNewCard = async (token: CardTokenResult) => {
    setSaving(true);
    try {
      await saveCard(token);
      setShowForm(false);
      toast({ title: 'Tarjeta guardada correctamente' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta tarjeta?')) return;
    try {
      await deleteMethod(id);
      toast({ title: 'Tarjeta eliminada' });
    } catch {
      toast({ title: 'Error al eliminar', variant: 'destructive' });
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await setDefault(id);
      toast({ title: 'Tarjeta predeterminada actualizada' });
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-2xl">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
            <ArrowLeft className="h-5 w-5" /> Volver
          </button>
          <h1 className="font-display text-2xl font-bold text-foreground mb-6">Métodos de Pago</h1>

          {loadingMethods ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <div className="space-y-3 mb-6">
              {savedMethods.map(m => (
                <div key={m.id} className={`flex items-center gap-4 p-4 rounded-xl border-2 bg-card ${m.isDefault ? 'border-primary' : 'border-border'}`}>
                  <CreditCard className="h-8 w-8 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground capitalize">{m.franchise} •••• {m.mask.slice(-4)}</p>
                      {m.isDefault && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">Predeterminada</span>}
                    </div>
                    <p className="text-sm text-muted-foreground">Vence {m.expMonth}/{m.expYear}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {!m.isDefault && (
                      <button onClick={() => handleSetDefault(m.id)} title="Establecer como predeterminada" className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                        <Star className="h-4 w-4" />
                      </button>
                    )}
                    <button onClick={() => handleDelete(m.id)} title="Eliminar" className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}

              {savedMethods.length === 0 && !showForm && (
                <p className="text-center text-muted-foreground py-8">No tienes tarjetas guardadas.</p>
              )}
            </div>
          )}

          {!showForm ? (
            <button onClick={() => setShowForm(true)} className="flex items-center gap-2 w-full p-4 rounded-xl border-2 border-dashed border-border hover:border-primary/40 text-muted-foreground hover:text-foreground transition-colors">
              <Plus className="h-5 w-5" /> Agregar tarjeta
            </button>
          ) : (
            <div className="bg-card rounded-2xl p-6 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-foreground">Nueva tarjeta</h2>
                <button onClick={() => setShowForm(false)} className="text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
              </div>
              <CardForm onSuccess={handleNewCard} submitLabel="Guardar tarjeta" loading={saving} />
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
