# Sistema de Logs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar logging estructurado (errores + acciones de usuario) con almacenamiento en PostgreSQL 90 días y panel admin con filtros.

**Architecture:** Nueva tabla `app_logs` en PostgreSQL. `lib/logger.ts` escribe fire-and-forget vía Prisma. Los Route Handlers llaman al logger en puntos clave. El panel admin en `/admin/logs` consulta vía `GET /api/admin/logs` con filtros de nivel, tipo, email y fecha.

**Tech Stack:** Next.js App Router, Prisma 6, PostgreSQL, TypeScript, vitest. Sin dependencias nuevas.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `prisma/schema.prisma` | Modify | Add `AppLog` model + relation on `User` |
| `lib/logger.ts` | Create | Fire-and-forget logger utility |
| `lib/__tests__/logger.test.ts` | Create | Unit tests for logger |
| `app/api/admin/logs/route.ts` | Create | GET logs with filters + pagination |
| `app/api/admin/logs/cleanup/route.ts` | Create | DELETE logs older than 90 days |
| `app/admin/logs/page.tsx` | Create | Admin UI — filters + table + detail |
| `app/admin/layout.tsx` | Modify | Add "Logs" nav item |
| `app/api/auth/signin/route.ts` | Modify | Log login_success / login_failed |
| `app/api/auth/signup/route.ts` | Modify | Log register |
| `app/api/auth/signout/route.ts` | Modify | Log logout |
| `app/api/orders/route.ts` | Modify | Log create_order |
| `app/api/payment-methods/route.ts` | Modify | Log card_saved |
| `app/api/payment-methods/[id]/route.ts` | Modify | Log card_deleted |
| `app/api/payment-methods/[id]/charge/route.ts` | Modify | Log charge_approved / charge_rejected / charge_failed |
| `app/api/subscriptions/route.ts` | Modify | Log subscription_created |
| `app/api/subscriptions/[id]/route.ts` | Modify | Log paused / cancelled / reactivated |
| `app/api/subscriptions/process-billing/route.ts` | Modify | Log billing_approved / billing_failed / subscription_auto_paused / billing_cron_run |
| `app/api/admin/subscriptions/[id]/charge/route.ts` | Modify | Log admin_charge_retry |

---

### Task 1: Schema — AppLog model

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add AppLog model to schema**

At the end of `prisma/schema.prisma`, before the final closing, add:

```prisma
model AppLog {
  id        String   @id @default(uuid()) @db.Uuid
  level     String
  type      String
  action    String
  message   String
  userId    String?  @map("user_id") @db.Uuid
  user      User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  metadata  Json?
  error     String?
  ipAddress String?  @map("ip_address")
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz

  @@index([level])
  @@index([type])
  @@index([userId])
  @@index([createdAt])
  @@map("app_logs")
}
```

- [ ] **Step 2: Add relation to User model**

In the `User` model, after the existing relations (after `paymentMethods PaymentMethod[]`), add:

```prisma
  appLogs   AppLog[]
```

- [ ] **Step 3: Push schema to database**

```bash
npx prisma db push
```

Expected output: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 4: Regenerate Prisma client**

```bash
npx prisma generate
```

Expected: `Generated Prisma Client`

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(logs): add AppLog model to schema"
```

---

### Task 2: lib/logger.ts + unit tests

**Files:**
- Create: `lib/logger.ts`
- Create: `lib/__tests__/logger.test.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/__tests__/logger.test.ts`:

```typescript
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockCreate = vi.fn().mockResolvedValue({});

vi.mock('@/lib/prisma', () => ({
  prisma: {
    appLog: {
      create: mockCreate,
    },
  },
}));

import { log } from '@/lib/logger';

describe('log', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls prisma.appLog.create with provided params', async () => {
    log({
      level: 'info',
      type: 'auth',
      action: 'login_success',
      message: 'Usuario autenticado',
      userId: 'user-uuid-1',
    });
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        level: 'info',
        type: 'auth',
        action: 'login_success',
        message: 'Usuario autenticado',
        userId: 'user-uuid-1',
      },
    });
  });

  it('does not throw when prisma.appLog.create rejects', async () => {
    mockCreate.mockRejectedValueOnce(new Error('DB connection lost'));
    expect(() =>
      log({ level: 'error', type: 'system', action: 'unhandled_error', message: 'Fallo crítico' })
    ).not.toThrow();
    await new Promise(resolve => setTimeout(resolve, 10));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --reporter=verbose 2>&1 | grep -E "FAIL|PASS|logger"
```

Expected: FAIL — `log is not a function` or similar.

- [ ] **Step 3: Create lib/logger.ts**

Create `lib/logger.ts`:

```typescript
import { prisma } from './prisma';

export type LogLevel = 'info' | 'warn' | 'error';
export type LogType = 'auth' | 'order' | 'payment' | 'subscription' | 'admin' | 'system';

export interface LogParams {
  level: LogLevel;
  type: LogType;
  action: string;
  message: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  error?: string;
  ipAddress?: string;
}

export function log(params: LogParams): void {
  prisma.appLog.create({ data: params }).catch(() => {});
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --reporter=verbose 2>&1 | tail -15
```

Expected: all tests pass (10 total including existing billing tests).

- [ ] **Step 5: Commit**

```bash
git add lib/logger.ts lib/__tests__/logger.test.ts
git commit -m "feat(logs): add lib/logger.ts with fire-and-forget log() function"
```

---

### Task 3: GET /api/admin/logs + DELETE /api/admin/logs/cleanup

**Files:**
- Create: `app/api/admin/logs/route.ts`
- Create: `app/api/admin/logs/cleanup/route.ts`

- [ ] **Step 1: Create GET /api/admin/logs**

Create `app/api/admin/logs/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const level = searchParams.get('level') || undefined;
    const type = searchParams.get('type') || undefined;
    const email = searchParams.get('email') || undefined;
    const from = searchParams.get('from') || undefined;
    const to = searchParams.get('to') || undefined;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const skip = (page - 1) * limit;

    const where = {
      ...(level && { level }),
      ...(type && { type }),
      ...(email && { user: { email: { contains: email, mode: 'insensitive' as const } } }),
      ...((from || to) && {
        createdAt: {
          ...(from && { gte: new Date(from) }),
          ...(to && { lte: new Date(to) }),
        },
      }),
    };

    const [logs, total] = await Promise.all([
      prisma.appLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { user: { select: { email: true } } },
      }),
      prisma.appLog.count({ where }),
    ]);

    const formatted = logs.map(l => ({
      id: l.id,
      level: l.level,
      type: l.type,
      action: l.action,
      message: l.message,
      userEmail: l.user?.email ?? null,
      userId: l.userId,
      metadata: l.metadata,
      error: l.error,
      ipAddress: l.ipAddress,
      createdAt: l.createdAt,
    }));

    return NextResponse.json({
      logs: formatted,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    if (message === 'Unauthorized' || message === 'Forbidden')
      return NextResponse.json({ message }, { status: 401 });
    return NextResponse.json({ message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create DELETE /api/admin/logs/cleanup**

Create `app/api/admin/logs/cleanup/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export async function DELETE() {
  try {
    await requireAdmin();

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);

    const { count } = await prisma.appLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    return NextResponse.json({ deleted: count });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    if (message === 'Unauthorized' || message === 'Forbidden')
      return NextResponse.json({ message }, { status: 401 });
    return NextResponse.json({ message }, { status: 500 });
  }
}
```

- [ ] **Step 3: Build check**

```bash
npm run build 2>&1 | grep -E "error TS|Error:" | head -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/logs/
git commit -m "feat(logs): add GET /api/admin/logs and DELETE /api/admin/logs/cleanup"
```

---

### Task 4: Admin UI + nav item

**Files:**
- Create: `app/admin/logs/page.tsx`
- Modify: `app/admin/layout.tsx`

- [ ] **Step 1: Add ScrollText to admin layout imports and nav**

In `app/admin/layout.tsx`, add `ScrollText` to the lucide-react import:

```tsx
import {
  LayoutDashboard,
  Package,
  Users,
  Truck,
  Coffee,
  LogOut,
  Menu,
  Loader2,
  RefreshCw,
  Ticket,
  CreditCard,
  LayoutGrid,
  ScrollText,
} from 'lucide-react';
```

In the `NAV_ITEMS` array (after the cupones entry), add:

```tsx
{ path: '/admin/logs', icon: ScrollText, label: 'Logs' },
```

- [ ] **Step 2: Create app/admin/logs/page.tsx**

Create `app/admin/logs/page.tsx`:

```tsx
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
```

- [ ] **Step 3: Build check**

```bash
npm run build 2>&1 | grep -E "error TS|Error:" | head -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/admin/logs/ app/admin/layout.tsx
git commit -m "feat(logs): add admin logs page and nav item"
```

---

### Task 5: Auth routes integration

**Files:**
- Modify: `app/api/auth/signin/route.ts`
- Modify: `app/api/auth/signup/route.ts`
- Modify: `app/api/auth/signout/route.ts`

- [ ] **Step 1: Add logging to signin route**

In `app/api/auth/signin/route.ts`, add import and log calls:

Add at top:
```typescript
import { log } from '@/lib/logger';
```

After the credentials check fails (`if (!user || !(await comparePassword(...)))`), add before the return:
```typescript
log({ level: 'warn', type: 'auth', action: 'login_failed', message: 'Credenciales incorrectas', metadata: { email } });
```

After `await setAuthCookies(accessToken, refreshToken)`, add:
```typescript
log({ level: 'info', type: 'auth', action: 'login_success', message: 'Usuario autenticado', userId: user.id, metadata: { email: user.email } });
```

The full file after changes:

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { comparePassword, signAccessToken, signRefreshToken, setAuthCookies } from '@/lib/auth';
import { log } from '@/lib/logger';

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    const user = await prisma.user.findUnique({
      where: { email },
      include: { roles: true, profile: true },
    });

    if (!user || !(await comparePassword(password, user.passwordHash))) {
      log({ level: 'warn', type: 'auth', action: 'login_failed', message: 'Credenciales incorrectas', metadata: { email } });
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }

    const accessToken = await signAccessToken({ sub: user.id, email: user.email });
    const refreshToken = await signRefreshToken({ sub: user.id, email: user.email });
    await setAuthCookies(accessToken, refreshToken);

    log({ level: 'info', type: 'auth', action: 'login_success', message: 'Usuario autenticado', userId: user.id, metadata: { email: user.email } });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        roles: user.roles.map((r) => r.role),
        profile: user.profile,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Add logging to signup route**

In `app/api/auth/signup/route.ts`, add import at top:
```typescript
import { log } from '@/lib/logger';
```

After `await setAuthCookies(accessToken, refreshToken)`, before the return, add:
```typescript
log({ level: 'info', type: 'auth', action: 'register', message: 'Nueva cuenta creada', userId: user.id, metadata: { email: user.email } });
```

- [ ] **Step 3: Add logging to signout route**

In `app/api/auth/signout/route.ts`, the session isn't available since cookies are cleared. Read the access token before clearing:

Replace all content with:
```typescript
import { NextResponse } from 'next/server';
import { clearAuthCookies, getSession } from '@/lib/auth';
import { log } from '@/lib/logger';

export async function POST() {
  try {
    const session = await getSession();
    await clearAuthCookies();
    if (session) {
      log({ level: 'info', type: 'auth', action: 'logout', message: 'Sesión cerrada', userId: session.id });
    }
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ message }, { status: 500 });
  }
}
```

- [ ] **Step 4: Build check**

```bash
npm run build 2>&1 | grep -E "error TS|Error:" | head -10
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/api/auth/signin/route.ts app/api/auth/signup/route.ts app/api/auth/signout/route.ts
git commit -m "feat(logs): add auth logging (login, register, logout)"
```

---

### Task 6: Orders + payment methods integration

**Files:**
- Modify: `app/api/orders/route.ts`
- Modify: `app/api/payment-methods/route.ts`
- Modify: `app/api/payment-methods/[id]/route.ts`
- Modify: `app/api/payment-methods/[id]/charge/route.ts`

- [ ] **Step 1: Log create_order in orders route**

In `app/api/orders/route.ts`, add at top:
```typescript
import { log } from '@/lib/logger';
```

In the POST handler, after the order is created successfully (after `prisma.order.create`), add:
```typescript
log({ level: 'info', type: 'order', action: 'create_order', message: 'Pedido creado', userId: session.id, metadata: { orderId: order.id, total: order.total } });
```

- [ ] **Step 2: Log card_saved in payment-methods route**

In `app/api/payment-methods/route.ts`, add import at top:
```typescript
import { log } from '@/lib/logger';
```

In the POST handler, after the payment method is created/updated (after `prisma.paymentMethod.upsert` or `prisma.paymentMethod.create`), add:
```typescript
log({ level: 'info', type: 'payment', action: 'card_saved', message: 'Tarjeta guardada', userId: session.id, metadata: { franchise: savedMethod.franchise, mask: savedMethod.mask } });
```

- [ ] **Step 3: Log card_deleted in payment-methods/[id] route**

In `app/api/payment-methods/[id]/route.ts`, add import at top:
```typescript
import { log } from '@/lib/logger';
```

In the DELETE handler, after the `prisma.paymentMethod.deleteMany` succeeds (after `if (result.count === 0)`), add before the success return:
```typescript
log({ level: 'info', type: 'payment', action: 'card_deleted', message: 'Tarjeta eliminada', userId: session.id, metadata: { paymentMethodId: id } });
```

- [ ] **Step 4: Log charge outcomes in payment-methods/[id]/charge route**

In `app/api/payment-methods/[id]/charge/route.ts`, add import at top:
```typescript
import { log } from '@/lib/logger';
```

Find the section after `const result = await chargeCard(...)`. Add these logs depending on result:

After the charge call succeeds with `approved`:
```typescript
log({ level: 'info', type: 'payment', action: 'charge_approved', message: 'Cobro aprobado', userId: session.id, metadata: { orderId: targetOrderId, amount, epaycoRef: result.epaycoRef } });
```

After the charge call succeeds with `rejected`:
```typescript
log({ level: 'warn', type: 'payment', action: 'charge_rejected', message: 'Cobro rechazado', userId: session.id, metadata: { orderId: targetOrderId, amount, epaycoRef: result.epaycoRef } });
```

In the catch block for `EpaycoError`, add:
```typescript
log({ level: 'error', type: 'payment', action: 'charge_failed', message: 'Error al procesar cobro', userId: session.id, metadata: { orderId: targetOrderId, amount }, error: err.message });
```

- [ ] **Step 5: Build check**

```bash
npm run build 2>&1 | grep -E "error TS|Error:" | head -10
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app/api/orders/route.ts app/api/payment-methods/
git commit -m "feat(logs): add order and payment method logging"
```

---

### Task 7: Subscriptions + billing cron + final build

**Files:**
- Modify: `app/api/subscriptions/route.ts`
- Modify: `app/api/subscriptions/[id]/route.ts`
- Modify: `app/api/subscriptions/process-billing/route.ts`
- Modify: `app/api/admin/subscriptions/[id]/charge/route.ts`

- [ ] **Step 1: Log subscription_created**

In `app/api/subscriptions/route.ts`, add import:
```typescript
import { log } from '@/lib/logger';
```

In the POST handler, after `prisma.subscription.create` succeeds, add:
```typescript
log({ level: 'info', type: 'subscription', action: 'subscription_created', message: 'Suscripción creada', userId: session.id, metadata: { subscriptionId: subscription.id, planId, price } });
```

- [ ] **Step 2: Log status changes in subscriptions/[id]**

In `app/api/subscriptions/[id]/route.ts`, add import:
```typescript
import { log } from '@/lib/logger';
```

In the PATCH handler, after `prisma.subscription.updateMany` succeeds (after `if (result.count === 0)` check), add:
```typescript
const actionMap: Record<string, string> = {
  active: 'subscription_reactivated',
  paused: 'subscription_paused',
  cancelled: 'subscription_cancelled',
};
log({ level: status === 'cancelled' || status === 'paused' ? 'warn' : 'info', type: 'subscription', action: actionMap[status] || `subscription_${status}`, message: `Suscripción ${status}`, userId: session.id, metadata: { subscriptionId: id } });
```

- [ ] **Step 3: Log billing events in process-billing**

In `app/api/subscriptions/process-billing/route.ts`, add import:
```typescript
import { log } from '@/lib/logger';
```

At the start of POST, after the BILLING_SECRET check passes, add:
```typescript
log({ level: 'info', type: 'system', action: 'billing_cron_run', message: 'Inicio de ciclo de cobros automáticos' });
```

In the per-subscription loop, after `chargeStatus = 'approved'` and `approved++`, add:
```typescript
log({ level: 'info', type: 'subscription', action: 'billing_approved', message: 'Cobro automático aprobado', userId: sub.userId, metadata: { subscriptionId: sub.id, amount: sub.price, epaycoRef } });
```

After `chargeStatus = 'rejected'` and `failed++`, add:
```typescript
log({ level: 'warn', type: 'subscription', action: 'billing_failed', message: 'Cobro automático rechazado', userId: sub.userId, metadata: { subscriptionId: sub.id, amount: sub.price } });
```

After `paused++` in the rejected path, add:
```typescript
log({ level: 'warn', type: 'subscription', action: 'subscription_auto_paused', message: 'Suscripción pausada por cobros fallidos consecutivos', userId: sub.userId, metadata: { subscriptionId: sub.id } });
```

In the catch block, after `failed++`, add:
```typescript
log({ level: 'error', type: 'subscription', action: 'billing_failed', message: 'Error inesperado en cobro automático', userId: sub.userId, metadata: { subscriptionId: sub.id, amount: sub.price }, error: err instanceof Error ? err.message : String(err) });
```

At the end, before `return NextResponse.json(...)`, add:
```typescript
log({ level: 'info', type: 'system', action: 'billing_cron_run', message: `Ciclo completado: ${approved} aprobados, ${failed} fallidos, ${paused} pausados`, metadata: { processed: subscriptions.length, approved, failed, paused } });
```

- [ ] **Step 4: Log admin retry charge**

In `app/api/admin/subscriptions/[id]/charge/route.ts`, add import:
```typescript
import { log } from '@/lib/logger';
```

After the charge result, add:
```typescript
log({ level: 'info', type: 'admin', action: 'admin_charge_retry', message: `Reintento de cobro admin: ${result.status}`, metadata: { subscriptionId: id, status: result.status, epaycoRef: result.epaycoRef } });
```

- [ ] **Step 5: Final build**

```bash
npm run build
```

Expected: clean build, no TypeScript errors.

- [ ] **Step 6: Run all tests**

```bash
npm test
```

Expected: 10 tests passing (8 billing + 2 logger).

- [ ] **Step 7: Commit**

```bash
git add app/api/subscriptions/ app/api/admin/subscriptions/
git commit -m "feat(logs): add subscription and billing cron logging"
```
