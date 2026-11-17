import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, Check, ChevronRight, ExternalLink, Link2, Pencil, PlayCircle, Search, Trash2, TrendingUp } from 'lucide-react';
import { db } from '../db/db';
import { deleteCustomExercise, setExerciseVideo } from '../db/repo';
import { EQUIPMENT_LABEL, MUSCLE_LABEL, RECORD_LABEL, TYPE_LABEL } from '../data/labels';
import { RECORD_TYPES } from '../lib/analytics';
import { fmtDate, fmtKg } from '../lib/format';
import { parseVideoUrl, youtubeSearchUrl } from '../lib/video';
import { MuscleMap } from '../components/MuscleMap';
import { Empty, PageHeader, Sheet, useConfirm, useToast } from '../components/ui/ui';

function VideoBlock({ id, nameEn, url }: { id: string; nameEn: string; url?: string }) {
  const [edit, setEdit] = useState(false);
  const [value, setValue] = useState(url ?? '');
  const [err, setErr] = useState<string | null>(null);
  const toast = useToast();
  const src = url ? parseVideoUrl(url) : null;
  return (
    <section className="card">
      <div className="card-title"><h3 className="row"><PlayCircle width={15} className="accent" /> Demonstração em vídeo</h3>
        <button className="btn btn-ghost btn-sm" onClick={() => { setValue(url ?? ''); setErr(null); setEdit(true); }}><Link2 /> {url ? 'Alterar' : 'Vincular'}</button>
      </div>
      {src ? (
        <div className="video-frame">
          {src.kind === 'file'
            ? <video src={src.src} controls playsInline preload="metadata" />
            : <iframe src={src.embed} title={`Demonstração: ${nameEn}`} loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />}
        </div>
      ) : (
        <div className="stack-sm">
          <p className="muted small">Nenhum vídeo vinculado. Encontre uma demonstração de fonte confiável (canais de educadores físicos, federações ou fabricantes) e vincule aqui para assistir dentro do app.</p>
          <a className="btn btn-block" href={youtubeSearchUrl(nameEn)} target="_blank" rel="noopener noreferrer"><Search /> Buscar demonstrações no YouTube <ExternalLink width={14} /></a>
        </div>
      )}
      <Sheet open={edit} onClose={() => setEdit(false)} title="Vincular vídeo"
        footer={<>
          {url && <button className="btn btn-danger" onClick={async () => { await setExerciseVideo(id, undefined); setEdit(false); toast('Vídeo removido'); }}><Trash2 /></button>}
          <button className="btn btn-primary grow" onClick={async () => {
            if (!parseVideoUrl(value)) { setErr('Use um link HTTPS do YouTube, Vimeo ou arquivo .mp4/.webm.'); return; }
            await setExerciseVideo(id, value.trim()); setEdit(false); toast('Vídeo vinculado');
          }}>Salvar</button>
        </>}>
        <div className="field">
          <label htmlFor="video-url">Link do vídeo</label>
          <input id="video-url" className={`input${err ? ' invalid' : ''}`} inputMode="url" placeholder="https://www.youtube.com/watch?v=..." value={value} onChange={(e) => { setValue(e.target.value); setErr(null); }} />
          {err ? <span className="field-error">{err}</span> : <span className="xs dim">Aceita YouTube (inclusive Shorts), Vimeo ou link direto de vídeo.</span>}
        </div>
      </Sheet>
    </section>
  );
}

export default function ExerciseDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();
  const ex = useLiveQuery(() => db.exercises.get(id!), [id]);
  const records = useLiveQuery(() => db.records.where('exerciseId').equals(id!).toArray(), [id]) ?? [];
  const timesDone = useLiveQuery(async () => new Set((await db.sets.where('exerciseId').equals(id!).toArray()).map((s) => s.sessionId)).size, [id]) ?? 0;

  if (ex === undefined) return <div className="page" />;
  if (ex === null || !ex) return <div className="page"><PageHeader title="Exercício" back="/exercicios" /><Empty icon={AlertTriangle} title="Exercício não encontrado" /></div>;

  return (
    <div className="page page-narrow">
      <PageHeader title={ex.namePt} sub={ex.nameEn} back
        actions={ex.custom ? <button className="icon-btn bordered" aria-label="Editar exercício" onClick={() => nav(`/exercicios/${ex.id}/editar`)}><Pencil /></button> : undefined} />

      <div className="row wrap" style={{ gap: 6 }}>
        <span className="tag accent">{MUSCLE_LABEL[ex.primary]}</span>
        <span className="tag">{EQUIPMENT_LABEL[ex.equipment]}</span>
        <span className="tag">{TYPE_LABEL[ex.type]}</span>
        {ex.custom && <span className="tag">Personalizado</span>}
      </div>

      <div className="grid md-grid-2 mt-4">
        <section className="card">
          <div className="card-title"><h3>Músculos trabalhados</h3></div>
          <MuscleMap primary={ex.primary} secondary={ex.secondary} />
          <div className="mt-3 small">
            <div><span className="dim">Principal: </span>{MUSCLE_LABEL[ex.primary]}</div>
            <div className="mt-1"><span className="dim">Secundários: </span>{ex.secondary.length ? ex.secondary.map((m) => MUSCLE_LABEL[m]).join(', ') : '—'}</div>
          </div>
        </section>
        <VideoBlock id={ex.id} nameEn={ex.nameEn} url={ex.videoUrl} />
      </div>

      {ex.instructions.length > 0 && (
        <section className="card mt-4">
          <div className="card-title"><h3>Execução</h3></div>
          <ol className="numbered">{ex.instructions.map((t, i) => <li key={i}>{t}</li>)}</ol>
        </section>
      )}
      <div className="grid md-grid-2 mt-4">
        {ex.tips.length > 0 && (
          <section className="card">
            <div className="card-title"><h3>Dicas de técnica</h3></div>
            <ul className="bullets">{ex.tips.map((t, i) => <li key={i}><Check className="success" />{t}</li>)}</ul>
          </section>
        )}
        {ex.mistakes.length > 0 && (
          <section className="card">
            <div className="card-title"><h3>Erros comuns</h3></div>
            <ul className="bullets">{ex.mistakes.map((t, i) => <li key={i}><AlertTriangle style={{ color: 'var(--warning)' }} />{t}</li>)}</ul>
          </section>
        )}
      </div>
      {ex.notes && (
        <section className="card mt-4">
          <div className="card-title"><h3>Observações</h3></div>
          <p className="muted small">{ex.notes}</p>
        </section>
      )}

      <section className="card mt-4">
        <div className="card-title"><h3>Seu desempenho</h3><span className="xs muted">{timesDone} sess{timesDone === 1 ? 'ão' : 'ões'}</span></div>
        {records.length ? (
          <div className="grid grid-2">
            {RECORD_TYPES.map((t) => {
              const r = records.find((x) => x.type === t);
              return (
                <div key={t} className="stat" style={{ background: 'var(--bg)' }}>
                  <div className="stat-label">{RECORD_LABEL[t]}</div>
                  <div className="stat-value" style={{ fontSize: 16 }}>{r ? (t === 'maxReps' ? `${r.value} reps` : fmtKg(r.value)) : '—'}</div>
                  {r && <div className="stat-hint">{fmtDate(r.date)}</div>}
                </div>
              );
            })}
          </div>
        ) : <p className="muted small">Você ainda não registrou este exercício.</p>}
        {timesDone > 0 && <Link to={`/progresso/${ex.id}`} className="btn btn-block mt-3"><TrendingUp /> Ver evolução completa <ChevronRight width={14} /></Link>}
      </section>

      {ex.custom && (
        <button className="btn btn-danger btn-block mt-6" onClick={async () => {
          if (!(await confirm({ title: 'Excluir exercício?', message: 'Ele também será removido das rotinas.', confirmLabel: 'Excluir', danger: true }))) return;
          try { await deleteCustomExercise(ex.id); toast('Exercício excluído'); nav('/exercicios', { replace: true }); }
          catch (e) { toast((e as Error).message, 'error'); }
        }}><Trash2 /> Excluir exercício</button>
      )}
    </div>
  );
}
