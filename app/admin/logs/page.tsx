'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Loader2, RefreshCw, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';

interface AppLog {
  id: string;
  level: string;
  type: string;
  action: string;
  message: string;
  userEmail: string | null;
  userId: string | null;
  metadata: Record<string, unknown> | null;
  error: string | null;
  ipAddress: string | null;
  createdAt: string;
}

interface LogsResponse {
  logs: AppLog[];
  total: number;
  page: number;
  totalPages: number;
}

const LEVEL_COLORS: Record<string, string> = {
  info: 'bg-blue-100 text-blue-700',
  warn: 'bg-yellow-100 text-yellow-700',
  error: 'bg-red-100 text-red-700',
};

const LEVEL_LABELS: Record<string, string> = {
  info: 'Info',
  warn: 'Advertencia',
  error: 'Error',
};

const TYPE_LABELS: Record<string, string> = {
  auth: 'Auth',
  order: 'Pedido',
  payment: 'Pago',
  subscription: 'Suscripción',
  admin: 'Admin',
  system: 'Sistema',
};

export default function AdminLogsPage() {
  const { toast } = useToast();
  const [data, setData] = useState<LogsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [cleaningUp, setCleaningUp] = useState(false);

  // Filters
  const [level, setLevel] = useState('');
  const [type, setType] = useState('');
  const [email, setEmail] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  const fetchLogs = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (level) params.set('level', level);
      if (type) params.set('type', type);
      if (email) params.set('email', email);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      params.set('page', String(p));
      params.set('limit', '50');

      const res = await fetch(`/api/admin/logs?${params}`);
      if (!res.ok) throw new Error('Error al cargar logs');
      setData(await res.json());
    } catch {
      toast({ title: 'Error al cargar logs', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [level, type, email, from, to, page, toast]);

  useEffect(() => { fetchLogs(1); setPage(1); }, [level, type, email, from, to]);
  useEffect(() => { fetchLogs(page); }, [page]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => fetchLogs(page), 30000);
    return () => clearInterval(id);
  }, [autoRefresh, page, fetchLogs]);

  const handleCleanup = async () => {
    if (!confirm('¿Eliminar todos los logs con más de 90 días?')) return;
    setCleaningUp(true);
    try {
      const res = await fetch('/api/admin/logs/cleanup', { method: 'DELETE' });
      const data = await res.json();
      toast({ title: `${data.deleted} logs eliminados` });
      fetchLogs(1);
      setPage(1);
    } catch {
      toast({ title: 'Error al limpiar', variant: 'destructive' });
    } finally {
      setCleaningUp(false);
    }
  };

  const clearFilters = () => {
    setLevel(''); setType(''); setEmail(''); setFrom(''); setTo('');
    setPage(1);
  };

  return (
    <div>
      {/* Filters */}
      <div className="bg-card rounded-xl p-4 shadow-soft mb-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-3">
          <select
            value={level}
            onChange={e => setLevel(e.target.value)}
            className="px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground"
          >
            <option value="">Todos los niveles</option>
            <option value="info">Info</option>
            <option value="warn">Advertencia</option>
            <option value="error">Error</option>
          </select>

          <select
            value={type}
            onChange={e => setType(e.target.value)}
            className="px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground"
          >
            <option value="">Todos los tipos</option>
            <option value="auth">Auth</option>
            <option value="order">Pedido</option>
            <option value="payment">Pago</option>
            <option value="subscription">Suscripción</option>
            <option value="admin">Admin</option>
            <option value="system">Sistema</option>
          </select>

          <input
            type="text"
            placeholder="Email de usuario"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground"
          />

          <input
            type="date"
            value={from}
            onChange={e => setFrom(e.target.value)}
            className="px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground"
          />

          <input
            type="date"
            value={to}
            onChange={e => setTo(e.target.value)}
            className="px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground"
          />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={clearFilters} className="text-sm text-muted-foreground hover:text-foreground">
            Limpiar filtros
          </button>
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer ml-auto">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={e => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            Auto-refresh 30s
          </label>
          <button
            onClick={() => fetchLogs(page)}
            className="p-2 text-muted-foreground hover:text-primary transition-colors"
            title="Refrescar"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={handleCleanup}
            disabled={cleaningUp}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors text-muted-foreground disabled:opacity-50"
          >
            {cleaningUp ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Limpiar logs antiguos
          </button>
        </div>
      </div>

      {/* Summary */}
      {data && (
        <p className="text-sm text-muted-foreground mb-3">
          {data.total} registros · página {data.page} de {data.totalPages}
        </p>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !data || data.logs.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-2xl">
          <p className="text-muted-foreground">No hay logs con los filtros seleccionados.</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl shadow-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  {['Fecha', 'Nivel', 'Tipo', 'Acción', 'Mensaje', 'Usuario', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.logs.map(log => (
                  <>
                    <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString('es-CO')}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${LEVEL_COLORS[log.level] || 'bg-muted text-muted-foreground'}`}>
                          {LEVEL_LABELS[log.level] || log.level}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {TYPE_LABELS[log.type] || log.type}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-foreground">{log.action}</td>
                      <td className="px-4 py-3 text-sm max-w-[240px] truncate">{log.message}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{log.userEmail || '—'}</td>
                      <td className="px-4 py-3">
                        {(log.metadata || log.error) && (
                          <button
                            onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {expandedId === log.id
                              ? <ChevronUp className="h-4 w-4" />
                              : <ChevronDown className="h-4 w-4" />}
                          </button>
                        )}
                      </td>
                    </tr>
                    {expandedId === log.id && (
                      <tr key={`${log.id}-detail`} className="bg-muted/20">
                        <td colSpan={7} className="px-6 py-4">
                          {log.error && (
                            <div className="mb-3">
                              <p className="text-xs font-semibold text-destructive mb-1">Error</p>
                              <pre className="text-xs text-foreground bg-background rounded-lg p-3 overflow-x-auto border border-border font-mono whitespace-pre-wrap">
                                {log.error}
                              </pre>
                            </div>
                          )}
                          {log.metadata && (
                            <div>
                              <p className="text-xs font-semibold text-foreground mb-1">Metadata</p>
                              <pre className="text-xs text-foreground bg-background rounded-lg p-3 overflow-x-auto border border-border font-mono">
                                {JSON.stringify(log.metadata, null, 2)}
                              </pre>
                            </div>
                          )}
                          {log.ipAddress && (
                            <p className="text-xs text-muted-foreground mt-2">IP: {log.ipAddress}</p>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 p-4 border-t border-border">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-2 rounded-lg border border-border hover:bg-muted disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm text-muted-foreground">
                {page} / {data.totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                disabled={page >= data.totalPages}
                className="p-2 rounded-lg border border-border hover:bg-muted disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
