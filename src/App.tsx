import { Component, lazy, Suspense, type ReactNode } from 'react';
import { createHashRouter, Navigate, Outlet, RouterProvider } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle } from 'lucide-react';
import { db } from './db/db';
import { Layout } from './components/layout/Layout';
import { ConfirmProvider, ToastProvider } from './components/ui/ui';
import Dashboard from './pages/Dashboard';

const Routines = lazy(() => import('./pages/Routines'));
const RoutineEditor = lazy(() => import('./pages/RoutineEditor'));
const Exercises = lazy(() => import('./pages/Exercises'));
const ExerciseDetail = lazy(() => import('./pages/ExerciseDetail'));
const ExerciseForm = lazy(() => import('./pages/ExerciseForm'));
const ActiveWorkout = lazy(() => import('./pages/ActiveWorkout'));
const Reports = lazy(() => import('./pages/Reports'));
const Profile = lazy(() => import('./pages/Profile'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const HistoryList = lazy(() => import('./pages/History').then((m) => ({ default: m.HistoryList })));
const SessionDetail = lazy(() => import('./pages/History').then((m) => ({ default: m.SessionDetail })));
const ExerciseProgress = lazy(() => import('./pages/Progress').then((m) => ({ default: m.ExerciseProgress })));
const Records = lazy(() => import('./pages/Progress').then((m) => ({ default: m.Records })));

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { console.error('[Setly]', error); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="onboard" style={{ justifyContent: 'center' }}>
        <div className="empty">
          <div className="empty-icon"><AlertTriangle /></div>
          <h3>Algo deu errado</h3>
          <p>Seus dados estão salvos no aparelho. Tente recarregar o aplicativo.</p>
          <code className="xs dim" style={{ wordBreak: 'break-word' }}>{this.state.error.message}</code>
          <button className="btn btn-primary mt-3" onClick={() => { location.hash = '#/'; location.reload(); }}>Recarregar</button>
        </div>
      </div>
    );
  }
}

const Fallback = () => <div className="page" aria-busy="true" />;

function Guard() {
  const profile = useLiveQuery(() => db.profile.get('me'), []);
  if (profile === undefined) return <div className="splash"><div className="spinner" /></div>;
  if (!profile?.onboarded) return <Navigate to="/boas-vindas" replace />;
  return <Suspense fallback={<Fallback />}><Outlet /></Suspense>;
}

const router = createHashRouter([
  { path: '/boas-vindas', element: <Suspense fallback={<Fallback />}><Onboarding /></Suspense> },
  {
    element: <Guard />,
    children: [
      { path: '/treino', element: <ActiveWorkout /> },
      {
        element: <Layout />,
        children: [
          { path: '/', element: <Dashboard /> },
          { path: '/treinos', element: <Routines /> },
          { path: '/treinos/nova', element: <RoutineEditor /> },
          { path: '/treinos/:id', element: <RoutineEditor /> },
          { path: '/exercicios', element: <Exercises /> },
          { path: '/exercicios/novo', element: <ExerciseForm /> },
          { path: '/exercicios/:id', element: <ExerciseDetail /> },
          { path: '/exercicios/:id/editar', element: <ExerciseForm /> },
          { path: '/relatorios', element: <Reports /> },
          { path: '/historico', element: <HistoryList /> },
          { path: '/historico/:id', element: <SessionDetail /> },
          { path: '/progresso/:id', element: <ExerciseProgress /> },
          { path: '/recordes', element: <Records /> },
          { path: '/perfil', element: <Profile /> },
          { path: '*', element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
]);

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <ConfirmProvider>
          <Suspense fallback={<Fallback />}>
            <RouterProvider router={router} />
          </Suspense>
        </ConfirmProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
