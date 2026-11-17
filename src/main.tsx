import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-500.css';
import '@fontsource/jetbrains-mono/latin-600.css';
import '@fontsource/jetbrains-mono/latin-700.css';
import './styles/global.css';
import App from './App';
import { initDatabase } from './db/repo';
import { initInstallPrompt } from './lib/install';
import { backgroundSync } from './lib/sync';

initInstallPrompt();

async function boot() {
  const root = createRoot(document.getElementById('root')!);
  try {
    await initDatabase();
  } catch (e) {
    console.error(e);
    document.getElementById('root')!.innerHTML =
      '<div style="padding:32px;font-family:monospace;color:#a1a1aa">Não foi possível acessar o armazenamento local. Verifique se o navegador não está em modo privado e tente novamente.</div>';
    return;
  }
  root.render(<StrictMode><App /></StrictMode>);
  document.getElementById('splash')?.remove();

  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    const { registerSW } = await import('virtual:pwa-register');
    registerSW({ immediate: true });
  }
  window.addEventListener('online', () => void backgroundSync());
  void backgroundSync();
}

void boot();
