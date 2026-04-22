'use client';

import { useState, useEffect } from 'react';
import { Users, Search, Loader2 } from 'lucide-react';

interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  phone: string | null;
  city: string | null;
  created_at: string;
}

export default function AdminCustomersPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => { fetchProfiles(); }, []);

  const fetchProfiles = async () => {
    try {
      const res = await fetch('/api/admin/customers');
      const data = await res.json();
      setProfiles((data as any[]).map((p: any) => ({
        id: p.id,
        user_id: p.userId,
        full_name: p.fullName,
        phone: p.phone,
        city: p.city,
        created_at: p.createdAt,
      })));
    } catch { /* ignore */ }
    setLoading(false);
  };

  const filtered = profiles.filter(p =>
    p.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.phone?.includes(searchTerm)
  );

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  return (
    <div>
      {/* Search */}
      <div className="mb-6">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por nombre, ciudad o teléfono..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary w-full text-sm"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-2xl">
          <Users className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="font-display text-xl text-foreground mb-2">No hay clientes</h3>
          <p className="text-muted-foreground text-sm">
            {searchTerm ? 'Sin resultados para esa búsqueda' : 'Los clientes aparecerán aquí cuando se registren'}
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl shadow-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-5 py-3.5 font-semibold text-muted-foreground uppercase tracking-wide text-xs">#</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-muted-foreground uppercase tracking-wide text-xs">Nombre</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-muted-foreground uppercase tracking-wide text-xs">Teléfono</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-muted-foreground uppercase tracking-wide text-xs">Ciudad</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-muted-foreground uppercase tracking-wide text-xs">Cliente desde</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((profile, i) => (
                  <tr key={profile.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3.5 text-xs text-muted-foreground">{i + 1}</td>
                    <td className="px-5 py-3.5 font-medium text-foreground">
                      {profile.full_name || <span className="text-muted-foreground italic">Sin nombre</span>}
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground">
                      {profile.phone || '—'}
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground">
                      {profile.city || '—'}
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground whitespace-nowrap">
                      {new Date(profile.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-border text-xs text-muted-foreground">
            {filtered.length} cliente{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  );
}
