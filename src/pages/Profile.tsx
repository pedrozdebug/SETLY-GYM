import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Camera, ChevronRight, Cloud, CloudOff, Download, History, LogOut, Pencil, Plus, RefreshCw, Smartphone, Trash2, Trophy, Upload } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { db } from '../db/db';
import { addBodyWeight, clearAllData, deleteBodyWeight, exportBackup, importBackup, saveProfile, savePrefs } from '../db/repo';
import type { Goal, Level, Profile as ProfileT } from '../db/types';
import { usePrefs, useProfile } from '../hooks/data';
import { ageFromBirth, parseDateInput, toDateInput } from '../lib/date';
import { fmtDate, fmtDateShort, fmtKg, fmtNum, fmtRelativeDay } from '../lib/format';
import { downloadJson } from '../lib/export';
import { canInstall, isIOS, isStandalone, onInstallChange, promptInstall } from '../lib/install';
import { currentUser, signIn, signOut, signUp, syncConfigured, syncNow } from '../lib/sync';
import { clearRestTimer } from '../hooks/useRestTimer';
import { GOAL_LABEL, LEVEL_LABEL } from '../data/labels';
import { LineChart } from '../components/charts/Charts';
import { Field, NumInput, PageHeader, Sheet, Stat, Switch, useConfirm, useToast } from '../components/ui/ui';

async function resizeImage(file: File, size = 256): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Imagem inválida')); i.src = url; });
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const ctx = c.getContext('2d')!;
    const s = Math.min(img.width, img.height);
    ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
    return c.toDataURL('image/jpeg', 0.85);
  } finally { URL.revokeObjectURL(url); }
}

type EditState = Pick<ProfileT, 'name' | 'birthDate' | 'heightCm' | 'goal' | 'level' | 'trainingSince'>;

export function validateProfile(e: EditState): Partial<Record<keyof EditState, string>> {
  const err: Partial<Record<keyof EditState, string>> = {};
  if (!e.name.trim()) err.name = 'Informe seu nome.';
  else if (e.name.length > 40) err.name = 'Máximo de 40 caracteres.';
  if (e.heightCm != null && (e.heightCm < 100 || e.heightCm > 250)) err.heightCm = 'Altura entre 100 e 250 cm.';
  if (e.birthDate) {
    const a = ageFromBirth(e.birthDate);
    if (a == null || a < 10 || a > 100) err.birthDate = 'Data de nascimento inválida.';
  }
  if (e.trainingSince && parseDateInput(e.trainingSince) > Date.now()) err.trainingSince = 'A data não pode estar no futuro.';
  return err;
}

function EditProfileSheet({ open, onClose, profile }: { open: boolean; onClose: () => void; profile: ProfileT }) {
  const [e, setE] = useState<EditState>(profile);
  const [submitted, setSubmitted] = useState(false);
  const toast = useToast();
  const errors = validateProfile(e);
  return (
    <Sheet open={open} onClose={onClose} title="Editar perfil" footer={<button className="btn btn-primary btn-block" onClick={async () => {
      setSubmitted(true);
      if (Object.keys(errors).length) return;
      await saveProfile({ ...e, name: e.name.trim() }); toast('Perfil atualizado'); onClose();
    }}>Salvar</button>}>
      <div className="stack">
        <Field label="Nome" error={submitted ? errors.name : null}><input className="input" maxLength={40} value={e.name} onChange={(x) => setE({ ...e, name: x.target.value })} /></Field>
        <div className="grid grid-2">
          <Field label="Nascimento" error={submitted ? errors.birthDate : null}><input type="date" className="input" value={e.birthDate ?? ''} max={toDateInput(Date.now())} onChange={(x) => setE({ ...e, birthDate: x.target.value || null })} /></Field>
          <Field label="Altura (cm)" error={submitted ? errors.heightCm : null}><NumInput value={e.heightCm} min={0} max={260} onChange={(v) => setE({ ...e, heightCm: v })} /></Field>
        </div>
        <Field label="Objetivo principal">
          <select className="select" value={e.goal} onChange={(x) => setE({ ...e, goal: x.target.value as Goal })}>
            {(Object.keys(GOAL_LABEL) as Goal[]).map((g) => <option key={g} value={g}>{GOAL_LABEL[g]}</option>)}
          </select>
        </Field>
        <Field label="Nível de experiência">
          <select className="select" value={e.level} onChange={(x) => setE({ ...e, level: x.target.value as Level })}>
            {(Object.keys(LEVEL_LABEL) as Level[]).map((g) => <option key={g} value={g}>{LEVEL_LABEL[g]}</option>)}
          </select>
        </Field>
        <Field label="Início dos treinos" error={submitted ? errors.trainingSince : null}><input type="date" className="input" value={e.trainingSince ?? ''} max={toDateInput(Date.now())} onChange={(x) => setE({ ...e, trainingSince: x.target.value || null })} /></Field>
      </div>
    </Sheet>
  );
}

function BodyWeightCard() {
  const weights = useLiveQuery(() => db.bodyWeights.orderBy('date').toArray(), []) ?? [];
  const [open, setOpen] = useState(false);
  const [w, setW] = useState<number | null>(null);
  const [date, setDate] = useState(toDateInput(Date.now()));
  const [err, setErr] = useState<string | null>(null);
  const confirm = useConfirm();
  const toast = useToast();
  const last = weights[weights.length - 1];
  const first = weights[0];
  return (
    <section className="card section">
      <div className="card-title"><h3>Peso corporal</h3><button className="btn btn-sm" onClick={() => { setW(last?.weight ?? null); setDate(toDateInput(Date.now())); setErr(null); setOpen(true); }}><Plus /> Registrar</button></div>
      {weights.length ? (
        <>
          <div className="row" style={{ gap: 16 }}>
            <div><div className="stat-value">{fmtKg(last.weight)}</div><div className="xs dim">{fmtRelativeDay(last.date)}</div></div>
            {weights.length > 1 && <div className="xs muted">{last.weight - first.weight >= 0 ? '+' : ''}{fmtNum(last.weight - first.weight)} kg desde {fmtDate(first.date)}</div>}
          </div>
          {weights.length > 1 && <div className="mt-3"><LineChart ariaLabel="Peso corporal" data={weights.map((x) => ({ x: x.date, y: x.weight, label: fmtDateShort(x.date) }))} format={(v) => `${fmtNum(v)}kg`} height={150} /></div>}
          <details className="mt-3">
            <summary className="xs muted" style={{ cursor: 'pointer' }}>Registros ({weights.length})</summary>
            <div className="list">
              {[...weights].reverse().map((x) => (
                <div className="list-row" key={x.id}>
                  <span className="grow small">{fmtDate(x.date)}</span>
                  <span className="small mono-num">{fmtKg(x.weight)}</span>
                  <button className="icon-btn sm" aria-label="Excluir registro" onClick={async () => { if (await confirm({ title: 'Excluir registro?', confirmLabel: 'Excluir', danger: true })) { await deleteBodyWeight(x.id); toast('Registro excluído'); } }}><Trash2 /></button>
                </div>
              ))}
            </div>
          </details>
        </>
      ) : <p className="muted small">Registre seu peso para acompanhar a evolução no gráfico.</p>}
      <Sheet open={open} onClose={() => setOpen(false)} title="Registrar peso" footer={<button className="btn btn-primary btn-block" onClick={async () => {
        if (w == null || w < 25 || w > 400) { setErr('Informe um peso entre 25 e 400 kg.'); return; }
        if (!date || parseDateInput(date) > Date.now()) { setErr('Data inválida.'); return; }
        await addBodyWeight(parseDateInput(date) + 12 * 3600_000, w); toast('Peso registrado'); setOpen(false);
      }}>Salvar</button>}>
        <div className="grid grid-2">
          <Field label="Peso (kg)" error={err}><NumInput decimal value={w} min={0} max={500} onChange={(v) => { setW(v); setErr(null); }} /></Field>
          <Field label="Data"><input type="date" className="input" value={date} max={toDateInput(Date.now())} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
      </Sheet>
    </section>
  );
}

function AccountCard() {
  const [user, setUser] = useState<User | null>(null);
  const [mode, setMode] = useState<'login' | 'signup' | null>(null);
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const lastSync = useLiveQuery(() => db.meta.get('lastSyncAt'), [])?.value as number | undefined;
  const toast = useToast();
  useEffect(() => { void currentUser().then(setUser).catch(() => setUser(null)); }, []);

  if (!syncConfigured) {
    return (
      <section className="card section">
        <div className="card-title"><h3 className="row"><CloudOff width={15} /> Conta e sincronização</h3><span className="tag">Modo local</span></div>
        <p className="muted small">Seus dados ficam salvos com segurança neste aparelho e funcionam offline. A sincronização em nuvem é ativada automaticamente quando o app é publicado com um backend configurado (veja o README). Use o backup abaixo para transferir dados entre aparelhos.</p>
      </section>
    );
  }

  const submit = async () => {
    setErr(null);
    if (!/^\S+@\S+\.\S+$/.test(email)) { setErr('E-mail inválido.'); return; }
    if (pw.length < 6) { setErr('A senha deve ter pelo menos 6 caracteres.'); return; }
    setBusy(true);
    try {
      if (mode === 'signup') {
        const r = await signUp(email, pw);
        if (r.needsConfirmation) { toast('Confirme seu e-mail para entrar', 'info'); setMode('login'); setBusy(false); return; }
      } else await signIn(email, pw);
      setUser(await currentUser());
      setMode(null);
      const res = await syncNow();
      toast(`Sincronizado: ${res.pushed} enviados, ${res.pulled} recebidos`);
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };

  return (
    <section className="card section">
      <div className="card-title"><h3 className="row"><Cloud width={15} /> Conta e sincronização</h3>{user && <span className="tag success">Conectado</span>}</div>
      {user ? (
        <div className="stack-sm">
          <div className="small">{user.email}</div>
          <div className="xs dim">{lastSync ? `Última sincronização: ${new Date(lastSync).toLocaleString('pt-BR')}` : 'Ainda não sincronizado'}</div>
          <div className="row mt-2">
            <button className="btn grow" disabled={busy} onClick={async () => { setBusy(true); try { const r = await syncNow(); toast(`Sincronizado: ${r.pushed} enviados, ${r.pulled} recebidos`); } catch (e) { toast((e as Error).message, 'error'); } setBusy(false); }}><RefreshCw className={busy ? 'spin' : ''} /> Sincronizar agora</button>
            <button className="btn btn-ghost" onClick={async () => { await signOut(); setUser(null); toast('Você saiu da conta'); }}><LogOut /> Sair</button>
          </div>
        </div>
      ) : (
        <>
          <p className="muted small">Entre para fazer backup na nuvem e sincronizar entre aparelhos. O app continua funcionando offline.</p>
          <div className="row mt-3"><button className="btn btn-primary grow" onClick={() => setMode('login')}>Entrar</button><button className="btn grow" onClick={() => setMode('signup')}>Criar conta</button></div>
        </>
      )}
      <Sheet open={!!mode} onClose={() => setMode(null)} title={mode === 'signup' ? 'Criar conta' : 'Entrar'} footer={<button className="btn btn-primary btn-block" disabled={busy} onClick={submit}>{busy ? <span className="spinner" /> : mode === 'signup' ? 'Criar conta' : 'Entrar'}</button>}>
        <div className="stack">
          <Field label="E-mail"><input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Senha" error={err}><input className="input" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
        </div>
      </Sheet>
    </section>
  );
}

function InstallCard() {
  const [, force] = useState(0);
  useEffect(() => onInstallChange(() => force((x) => x + 1)), []);
  if (isStandalone()) return null;
  const ios = isIOS();
  if (!canInstall() && !ios) return null;
  return (
    <section className="card section row" style={{ gap: 12 }}>
      <span className="ex-icon"><Smartphone aria-hidden /></span>
      <div className="grow">
        <b className="small">Instalar o Setly Gym</b>
        <div className="xs muted">{ios ? 'No Safari, toque em Compartilhar → "Adicionar à Tela de Início".' : 'Use como aplicativo, em tela cheia e offline.'}</div>
      </div>
      {!ios && <button className="btn btn-primary btn-sm" onClick={() => void promptInstall()}>Instalar</button>}
    </section>
  );
}

export default function Profile() {
  const profile = useProfile();
  const prefs = usePrefs();
  const confirm = useConfirm();
  const toast = useToast();
  const [edit, setEdit] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const lastWeight = useLiveQuery(() => db.bodyWeights.orderBy('date').last(), []);
  const totalSessions = useLiveQuery(() => db.sessions.where('status').equals('done').count(), []) ?? 0;
  const age = ageFromBirth(profile.birthDate);

  return (
    <div className="page page-narrow">
      <PageHeader title="Perfil" actions={<button className="icon-btn bordered" aria-label="Editar perfil" onClick={() => setEdit(true)}><Pencil /></button>} />

      <section className="card row" style={{ gap: 16 }}>
        <button className="avatar lg" style={{ border: 0, cursor: 'pointer', position: 'relative' }} onClick={() => fileRef.current?.click()} aria-label="Alterar foto de perfil">
          {profile.photo ? <img src={profile.photo} alt="Foto de perfil" /> : (profile.name[0] ?? '?').toUpperCase()}
          <span style={{ position: 'absolute', right: 0, bottom: 0, width: 28, height: 28, borderRadius: 14, background: 'var(--accent)', display: 'grid', placeItems: 'center', color: '#fff' }}><Camera width={14} /></span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          try { await saveProfile({ photo: await resizeImage(f) }); toast('Foto atualizada'); } catch (er) { toast((er as Error).message, 'error'); }
        }} />
        <div className="grow" style={{ minWidth: 0 }}>
          <h2 style={{ fontSize: 18 }} className="truncate">{profile.name || 'Sem nome'}</h2>
          <div className="row wrap mt-2" style={{ gap: 6 }}>
            <span className="tag accent">{GOAL_LABEL[profile.goal]}</span>
            <span className="tag">{LEVEL_LABEL[profile.level]}</span>
          </div>
          {profile.photo && <button className="xs dim mt-2" style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer' }} onClick={() => saveProfile({ photo: null })}>Remover foto</button>}
        </div>
      </section>

      <div className="grid grid-4 section">
        <Stat label="Idade" value={age ?? '—'} unit={age != null ? ' anos' : undefined} />
        <Stat label="Altura" value={profile.heightCm ?? '—'} unit={profile.heightCm ? ' cm' : undefined} />
        <Stat label="Peso" value={lastWeight ? fmtNum(lastWeight.weight) : '—'} unit={lastWeight ? ' kg' : undefined} hint={lastWeight && profile.heightCm ? `IMC ${fmtNum(lastWeight.weight / (profile.heightCm / 100) ** 2)}` : undefined} />
        <Stat label="Treinando desde" value={profile.trainingSince ? fmtDate(parseDateInput(profile.trainingSince), { month: 'short', year: 'numeric' }) : '—'} hint={`${totalSessions} treinos no app`} />
      </div>

      <BodyWeightCard />

      <div className="stack section">
        <Link to="/historico" className="card card-link row"><History width={18} className="accent" /><span className="grow small">Histórico de treinos</span><ChevronRight className="dim" width={16} /></Link>
        <Link to="/recordes" className="card card-link row"><Trophy width={18} style={{ color: '#fcd34d' }} /><span className="grow small">Recordes pessoais</span><ChevronRight className="dim" width={16} /></Link>
      </div>

      <InstallCard />

      <section className="card section">
        <div className="card-title"><h3>Preferências do treino</h3></div>
        <div className="list">
          {[
            { k: 'autoRest' as const, l: 'Iniciar descanso automaticamente', d: 'Ao concluir uma série' },
            { k: 'sound' as const, l: 'Alerta sonoro', d: 'Ao fim do descanso' },
            { k: 'vibration' as const, l: 'Vibração', d: 'Em aparelhos compatíveis' },
            { k: 'keepAwake' as const, l: 'Manter tela ligada', d: 'Durante o treino ativo' },
          ].map((o) => (
            <label className="list-row" key={o.k} style={{ cursor: 'pointer' }}>
              <div className="grow"><div className="small">{o.l}</div><div className="xs dim">{o.d}</div></div>
              <Switch label={o.l} checked={prefs[o.k]} onChange={(v) => savePrefs({ [o.k]: v })} />
            </label>
          ))}
          <div className="list-row">
            <div className="grow"><div className="small">Descanso padrão</div><div className="xs dim">Para novos exercícios</div></div>
            <select className="select" style={{ width: 110 }} value={prefs.defaultRestSec} onChange={(e) => savePrefs({ defaultRestSec: Number(e.target.value) })} aria-label="Descanso padrão">
              {[30, 45, 60, 75, 90, 120, 150, 180, 240, 300].map((s) => <option key={s} value={s}>{Math.floor(s / 60)}:{String(s % 60).padStart(2, '0')}</option>)}
            </select>
          </div>
          <div className="list-row">
            <div className="grow"><div className="small">Incremento de carga</div><div className="xs dim">Usado nas sugestões de progressão</div></div>
            <select className="select" style={{ width: 110 }} value={prefs.weightStep} onChange={(e) => savePrefs({ weightStep: Number(e.target.value) })} aria-label="Incremento de carga">
              {[0.5, 1, 1.25, 2, 2.5, 5].map((s) => <option key={s} value={s}>{String(s).replace('.', ',')} kg</option>)}
            </select>
          </div>
        </div>
      </section>

      <AccountCard />

      <section className="card section">
        <div className="card-title"><h3>Dados</h3></div>
        <div className="grid grid-2" style={{ gap: 8 }}>
          <button className="btn" onClick={async () => { downloadJson(`setly-backup-${toDateInput(Date.now())}.json`, await exportBackup()); toast('Backup exportado'); }}><Download /> Exportar backup</button>
          <button className="btn" onClick={() => importRef.current?.click()}><Upload /> Restaurar backup</button>
        </div>
        <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          if (!(await confirm({ title: 'Restaurar backup?', message: 'Os dados atuais deste aparelho serão substituídos pelos do arquivo.', confirmLabel: 'Restaurar', danger: true }))) return;
          try { await importBackup(JSON.parse(await f.text())); toast('Backup restaurado'); } catch (er) { toast((er as Error).message || 'Arquivo inválido', 'error'); }
        }} />
        <button className="btn btn-danger btn-block mt-3" onClick={async () => {
          if (!(await confirm({ title: 'Apagar todos os dados?', message: 'Rotinas, treinos, recordes e perfil serão apagados deste aparelho. Essa ação não pode ser desfeita.', confirmLabel: 'Apagar tudo', danger: true }))) return;
          clearRestTimer();
          await clearAllData();
          location.reload();
        }}><Trash2 /> Apagar todos os dados</button>
      </section>

      <p className="xs dim center section">Setly Gym · v{__APP_VERSION__}</p>
      {edit && <EditProfileSheet open onClose={() => setEdit(false)} profile={profile} />}
    </div>
  );
}
