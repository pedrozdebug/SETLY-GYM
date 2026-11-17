import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { BookOpen, ChartColumn, Dumbbell, House, Play, User, WifiOff, Activity } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useActiveSession } from '../../hooks/data';
import { useOnlineStatus } from '../../hooks/useOnline';
import { sessionDurationSec } from '../../lib/analytics';
import { fmtClock } from '../../lib/format';

const NAV = [
  { to: '/', label: 'Início', icon: House, end: true },
  { to: '/treinos', label: 'Treinos', icon: Dumbbell },
  { to: '/exercicios', label: 'Exercícios', icon: BookOpen },
  { to: '/relatorios', label: 'Relatórios', icon: ChartColumn },
  { to: '/perfil', label: 'Perfil', icon: User },
];

export function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark"><Activity aria-hidden /></span>
      <span>Setly<span className="accent"> Gym</span></span>
    </div>
  );
}

function ActiveBanner() {
  const active = useActiveSession();
  const nav = useNavigate();
  const [, force] = useState(0);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => force((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [active]);
  if (!active) return null;
  return (
    <button className="rest-mini" onClick={() => nav('/treino')} aria-label="Voltar ao treino em andamento">
      <Play aria-hidden /> {active.name} · {fmtClock(sessionDurationSec(active))}
    </button>
  );
}

export function Layout() {
  const online = useOnlineStatus();
  return (
    <div className="app">
      <aside className="sidebar" aria-label="Navegação principal">
        <Brand />
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `side-item${isActive ? ' active' : ''}`}>
            <Icon aria-hidden /> {label}
          </NavLink>
        ))}
        <div className="spacer" />
        <NavLink to="/historico" className={({ isActive }) => `side-item${isActive ? ' active' : ''}`}>Histórico</NavLink>
        <NavLink to="/recordes" className={({ isActive }) => `side-item${isActive ? ' active' : ''}`}>Recordes</NavLink>
      </aside>
      <main className="main">
        {!online && <div className="offline-pill" role="status"><WifiOff aria-hidden /> Offline · dados salvos no aparelho</div>}
        <Outlet />
      </main>
      <ActiveBanner />
      <nav className="bottom-nav" aria-label="Navegação principal">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <Icon aria-hidden /> <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
