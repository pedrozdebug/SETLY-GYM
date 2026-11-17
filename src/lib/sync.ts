// Optional cloud sync + authentication through Supabase.
// Enabled only when VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set at
// build time. Without them the app runs 100% local (IndexedDB) and offline.
//
// Strategy: every record is stored in one generic table keyed by
// (user_id, tbl, rid) with its JSON payload and `updated_at`.
// Push = local rows changed since the last push (+ tombstones).
// Pull = remote rows changed since the last pull, merged last-write-wins.
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { db, SYNC_TABLES, type SyncTable } from '../db/db';

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const REMOTE_TABLE = 'setly_records';

export const syncConfigured = Boolean(URL && KEY);

let client: SupabaseClient | null = null;
async function getClient(): Promise<SupabaseClient> {
  if (!syncConfigured) throw new Error('Sincronização não configurada.');
  if (!client) {
    const { createClient } = await import('@supabase/supabase-js');
    client = createClient(URL!, KEY!, { auth: { persistSession: true, autoRefreshToken: true } });
  }
  return client;
}

export async function currentUser(): Promise<User | null> {
  if (!syncConfigured) return null;
  const c = await getClient();
  const { data } = await c.auth.getSession();
  return data.session?.user ?? null;
}

export async function signIn(email: string, password: string) {
  const c = await getClient();
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(translateAuthError(error.message));
}

export async function signUp(email: string, password: string) {
  const c = await getClient();
  const { data, error } = await c.auth.signUp({ email, password });
  if (error) throw new Error(translateAuthError(error.message));
  return { needsConfirmation: !data.session };
}

export async function signOut() {
  const c = await getClient();
  await c.auth.signOut();
  await db.meta.bulkDelete(['lastPush', 'lastPull']);
}

function translateAuthError(msg: string): string {
  if (/invalid login/i.test(msg)) return 'E-mail ou senha incorretos.';
  if (/already registered/i.test(msg)) return 'Este e-mail já está cadastrado.';
  if (/password/i.test(msg)) return 'Senha inválida (mínimo de 6 caracteres).';
  return msg;
}

async function getMeta(key: string): Promise<number> {
  return ((await db.meta.get(key))?.value as number) ?? 0;
}

export interface SyncResult { pushed: number; pulled: number; at: number }

let running: Promise<SyncResult> | null = null;
export function syncNow(): Promise<SyncResult> {
  if (!running) running = doSync().finally(() => { running = null; });
  return running;
}

async function doSync(): Promise<SyncResult> {
  if (!navigator.onLine) throw new Error('Sem conexão com a internet.');
  const c = await getClient();
  const user = await currentUser();
  if (!user) throw new Error('Faça login para sincronizar.');
  const startedAt = Date.now();
  const lastPush = await getMeta('lastPush');
  const lastPull = await getMeta('lastPull');

  // ── push
  type Row = { user_id: string; tbl: string; rid: string; data: unknown; updated_at: number; deleted: boolean };
  const rows: Row[] = [];
  for (const t of SYNC_TABLES) {
    const changed = await db.table(t).where('updatedAt').above(lastPush).toArray().catch(async () =>
      (await db.table(t).toArray()).filter((r: { updatedAt: number }) => r.updatedAt > lastPush));
    for (const r of changed) {
      // active sessions stay local until finished
      if (t === 'sessions' && r.status === 'active') continue;
      rows.push({ user_id: user.id, tbl: t, rid: String(r.id), data: r, updated_at: r.updatedAt, deleted: false });
    }
  }
  const tombs = await db.tombstones.where('deletedAt').above(lastPush).toArray();
  for (const tb of tombs) rows.push({ user_id: user.id, tbl: tb.table, rid: tb.recordId, data: null, updated_at: tb.deletedAt, deleted: true });
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await c.from(REMOTE_TABLE).upsert(rows.slice(i, i + 500), { onConflict: 'user_id,tbl,rid' });
    if (error) throw new Error(`Falha ao enviar dados: ${error.message}`);
  }

  // ── pull
  let pulled = 0;
  let from = 0;
  const page = 1000;
  for (;;) {
    const { data, error } = await c.from(REMOTE_TABLE).select('tbl,rid,data,updated_at,deleted')
      .gt('updated_at', lastPull).order('updated_at', { ascending: true }).range(from, from + page - 1);
    if (error) throw new Error(`Falha ao baixar dados: ${error.message}`);
    if (!data?.length) break;
    await db.transaction('rw', SYNC_TABLES.map((t) => db.table(t)), async () => {
      for (const row of data as { tbl: SyncTable; rid: string; data: { updatedAt: number } | null; updated_at: number; deleted: boolean }[]) {
        if (!SYNC_TABLES.includes(row.tbl)) continue;
        const table = db.table(row.tbl);
        const key = row.tbl === 'schedule' ? Number(row.rid) : row.rid;
        const local = await table.get(key);
        if (local && local.updatedAt > row.updated_at) continue; // local is newer
        if (row.deleted) await table.delete(key);
        else if (row.data) await table.put(row.data);
        pulled++;
      }
    });
    if (data.length < page) break;
    from += page;
  }

  await db.meta.bulkPut([{ key: 'lastPush', value: startedAt }, { key: 'lastPull', value: startedAt }, { key: 'lastSyncAt', value: Date.now() }]);
  return { pushed: rows.length, pulled, at: Date.now() };
}

/** Fire-and-forget sync used after important writes and when connectivity returns. */
export async function backgroundSync() {
  if (!syncConfigured || !navigator.onLine) return;
  try {
    if (await currentUser()) await syncNow();
  } catch (e) {
    console.warn('[sync]', e);
  }
}
