'use client';

import { useState, useEffect } from 'react';
import { Users, Search, Loader2, Phone, MapPin } from 'lucide-react';

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
    } catch {
      // ignore
    }
    setLoading(false);
  };

  const filteredProfiles = profiles.filter(profile =>
    profile.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    profile.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    profile.phone?.includes(searchTerm)
  );

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <h2 className="font-display text-2xl font-bold text-foreground">Clientes</h2>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input type="text" placeholder="Buscar cliente..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary w-full" />
        </div>
      </div>

      {filteredProfiles.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-2xl">
          <Users className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="font-display text-xl font-semibold text-foreground mb-2">No hay clientes</h3>
          <p className="text-muted-foreground">
            {searchTerm ? 'No se encontraron clientes con esa busqueda' : 'Los clientes apareceran aqui cuando se registren'}
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProfiles.map(profile => (
            <div key={profile.id} className="bg-card rounded-xl p-6 shadow-soft">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{profile.full_name || 'Sin nombre'}</h3>
                  <p className="text-xs text-muted-foreground">
                    Cliente desde {new Date(profile.created_at).toLocaleDateString('es-CO', { month: 'short', year: 'numeric' })}
                  </p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                {profile.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground"><Phone className="h-4 w-4" />{profile.phone}</div>
                )}
                {profile.city && (
                  <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-4 w-4" />{profile.city}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
