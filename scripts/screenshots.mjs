// Generates store screenshots (public/screenshots) for the web manifest / PWABuilder.
// Runs against the Vite DEV server and fills an isolated browser profile with a
// demo history created through the app's own data layer. This demo data lives
// only in that throwaway browser context — it is never bundled into the app.
// Usage: npx vite --port 5199 &  node scripts/screenshots.mjs http://localhost:5199
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = process.argv[2] ?? 'http://localhost:5199';
mkdirSync('public/screenshots', { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto(BASE);
await page.getByPlaceholder('Seu nome').waitFor();

await page.evaluate(async () => {
  const repo = await import('/src/db/repo.ts');
  const { db } = await import('/src/db/db.ts');
  await repo.saveProfile({ name: 'Alex', goal: 'hipertrofia', level: 'intermediario', onboarded: true, heightCm: 178, trainingSince: '2023-02-01' });
  const ids = await repo.applyTemplate('ppl', true);
  const DAY = 86400000;
  const today = new Date(); today.setHours(18, 0, 0, 0);
  const start = today.getTime() - 9 * 7 * DAY;
  const seed = (n) => (Math.sin(n * 9301 + 49297) + 1) / 2;
  let k = 0;
  for (let t = start; t < today.getTime() - DAY; t += DAY) {
    const dow = new Date(t).getDay();
    const idx = [null, 0, 1, 2, 0, 1, 2][dow];
    if (idx == null || seed(++k) < 0.12) continue;
    const week = Math.floor((t - start) / (7 * DAY));
    const sid = await repo.startSession(ids[idx]);
    const s = await db.sessions.get(sid);
    s.startedAt = t;
    s.exercises = s.exercises.map((e, ei) => {
      const base = { 'supino-reto-barra': 70, 'agachamento-livre': 90, 'barra-fixa': 0, 'remada-curvada-barra': 60, 'levantamento-terra-romeno': 80, 'leg-press': 180 }[e.exerciseId] ?? 14 + ei * 4;
      const w = Math.round((base + week * (base > 50 ? 2.5 : 1) * (seed(k + ei) > 0.3 ? 1 : 0.6)) * 2) / 2;
      return { ...e, sets: e.sets.map((x, si) => ({ ...x, weight: w, reps: Math.max(e.repMin, e.repMax - si - (seed(k * 7 + si) > 0.6 ? 1 : 0)), done: true, completedAt: t })) };
    });
    await repo.persistSession(s);
    const done = await repo.finishSession(sid);
    const dur = 3000 + Math.round(seed(k * 3) * 1500);
    await db.sessions.update(sid, { endedAt: t + dur * 1000, durationSec: dur });
    void done;
  }
  for (let i = 0; i < 9; i++) await repo.addBodyWeight(start + i * 7 * DAY, 80.5 + i * 0.35 + (seed(i) - 0.5) * 0.6);
});

const shot = async (hash, file, prep) => {
  await page.goto(`${BASE}/#${hash}`);
  await page.waitForTimeout(700);
  if (prep) await prep();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `public/screenshots/${file}.png` });
};
await shot('/', 'mobile-dashboard');
await shot('/progresso/supino-reto-barra', 'mobile-progress');
await page.setViewportSize({ width: 1280, height: 720 });
await shot('/relatorios', 'desktop-reports', async () => { await page.getByRole('tab', { name: '90d' }).click(); });
await page.setViewportSize({ width: 390, height: 844 });
await shot('/', 'mobile-workout', async () => {
  await page.getByRole('button', { name: /Iniciar treino/ }).first().click();
  await page.getByText(/Exercício 1 de/).waitFor();
  await page.getByLabel('Concluir série 1').click();
  await page.getByRole('timer').waitFor();
  await page.getByLabel('Minimizar cronômetro').click();
});
await browser.close();
console.log('screenshots generated');
