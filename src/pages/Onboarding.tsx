import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { saveProfile } from '../db/repo';
import type { Goal, Level } from '../db/types';
import { GOAL_LABEL, LEVEL_LABEL } from '../data/labels';
import { Brand } from '../components/layout/Layout';

const GOAL_DESC: Record<Goal, string> = {
  hipertrofia: 'Ganho de massa muscular',
  forca: 'Mover cargas cada vez maiores',
  resistencia: 'Mais repetições, menos fadiga',
  condicionamento: 'Saúde e disposição',
  manutencao: 'Manter o que já conquistou',
};

export default function Onboarding() {
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [goal, setGoal] = useState<Goal>('hipertrofia');
  const [level, setLevel] = useState<Level>('iniciante');
  const [err, setErr] = useState<string | null>(null);

  const finish = async () => {
    await saveProfile({ name: name.trim(), goal, level, onboarded: true });
    nav('/', { replace: true });
  };

  return (
    <div className="onboard">
      <Brand />
      <div className="row mt-6" style={{ gap: 6 }} aria-hidden>
        {[0, 1, 2].map((i) => <span key={i} style={{ height: 3, flex: 1, borderRadius: 2, background: i <= step ? 'var(--accent)' : 'var(--surface-3)', transition: 'background 0.2s' }} />)}
      </div>

      <div style={{ flex: 1, marginTop: 32 }}>
        {step === 0 && (
          <div className="stack">
            <div className="eyebrow accent">Bem-vindo</div>
            <h1 style={{ fontSize: 26 }}>Treino registrado.<br />Evolução medida.</h1>
            <p className="muted">Monte suas rotinas, registre cada série e acompanhe sua progressão de cargas — tudo salvo no seu aparelho, funcionando offline.</p>
            <div className="field mt-4">
              <label htmlFor="ob-name">Como podemos te chamar?</label>
              <input id="ob-name" className={`input${err ? ' invalid' : ''}`} autoFocus maxLength={40} value={name} placeholder="Seu nome" onChange={(e) => { setName(e.target.value); setErr(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') (document.getElementById('ob-next') as HTMLButtonElement)?.click(); }} />
              {err && <span className="field-error">{err}</span>}
            </div>
          </div>
        )}
        {step === 1 && (
          <div className="stack">
            <div className="eyebrow accent">Objetivo</div>
            <h1 style={{ fontSize: 22 }}>Qual é o seu objetivo principal?</h1>
            <div className="stack-sm mt-2">
              {(Object.keys(GOAL_LABEL) as Goal[]).map((g) => (
                <button key={g} className={`choice${goal === g ? ' active' : ''}`} onClick={() => setGoal(g)} aria-pressed={goal === g}>
                  <span className="grow"><b className="small">{GOAL_LABEL[g]}</b><span className="xs muted" style={{ display: 'block' }}>{GOAL_DESC[g]}</span></span>
                  {goal === g && <Check width={18} className="accent" />}
                </button>
              ))}
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="stack">
            <div className="eyebrow accent">Experiência</div>
            <h1 style={{ fontSize: 22 }}>Há quanto tempo você treina?</h1>
            <div className="stack-sm mt-2">
              {(Object.keys(LEVEL_LABEL) as Level[]).map((l) => (
                <button key={l} className={`choice${level === l ? ' active' : ''}`} onClick={() => setLevel(l)} aria-pressed={level === l}>
                  <span className="grow"><b className="small">{LEVEL_LABEL[l]}</b><span className="xs muted" style={{ display: 'block' }}>{l === 'iniciante' ? 'Menos de 1 ano' : l === 'intermediario' ? 'Entre 1 e 3 anos' : 'Mais de 3 anos'}</span></span>
                  {level === l && <Check width={18} className="accent" />}
                </button>
              ))}
            </div>
            <p className="xs dim">Você pode completar idade, altura, peso e foto depois, no Perfil.</p>
          </div>
        )}
      </div>

      <div className="row mt-6">
        {step > 0 && <button className="btn btn-lg btn-ghost" onClick={() => setStep(step - 1)}>Voltar</button>}
        <button id="ob-next" className="btn btn-primary btn-lg grow" onClick={() => {
          if (step === 0 && !name.trim()) { setErr('Informe seu nome para continuar.'); return; }
          if (step < 2) setStep(step + 1); else void finish();
        }}>{step < 2 ? 'Continuar' : 'Começar'} <ArrowRight /></button>
      </div>
    </div>
  );
}
