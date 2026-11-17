// End-to-end smoke test of the main flows. Usage: node tests/e2e.mjs [baseUrl] [shotsDir]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = process.argv[2] ?? 'http://localhost:4173';
const SHOTS = process.argv[3] ?? '/tmp';
const errors = [];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, acceptDownloads: true, hasTouch: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
const shot = (n) => page.screenshot({ path: `${SHOTS}/${n}.png` });
const step = (s) => console.log('→', s);

await page.goto(BASE);
step('onboarding');
await page.getByText('Treino registrado.').waitFor();
await page.getByRole('button', { name: /Continuar/ }).click();
await page.getByText('Informe seu nome para continuar.').waitFor();
await page.getByPlaceholder('Seu nome').fill('Pedro Teste');
await page.getByRole('button', { name: /Continuar/ }).click();
await page.getByRole('button', { name: /Força/ }).click();
await page.getByRole('button', { name: /Continuar/ }).click();
await page.getByRole('button', { name: /Intermediário/ }).click();
await page.getByRole('button', { name: /Começar/ }).click();
await page.getByText(/Pedro\./).waitFor();
await shot('01-dashboard-empty');

step('create routine');
await page.getByRole('link', { name: 'Treinos' }).last().click();
await page.getByRole('button', { name: /Nova/ }).click();
await page.getByRole('button', { name: /Salvar/ }).click();
await page.getByText('Dê um nome ao treino.').waitFor();
await page.getByPlaceholder(/Push A/).fill('Push A');
await page.getByRole('button', { name: /Adicionar exercícios/ }).click();
await page.getByLabel('Buscar exercício').fill('supino reto');
await page.getByRole('button', { name: /Supino reto com barra/ }).click();
await page.getByLabel('Buscar exercício').fill('elevação lateral com');
await page.getByRole('button', { name: /Elevação lateral com halteres/ }).click();
await page.getByRole('button', { name: /Adicionar \(2\)/ }).click();
// set sets=2 for first, rest 5s to keep test fast
const sets = page.getByLabel('Séries');
await sets.nth(0).fill('2');
await sets.nth(1).fill('1');
await page.getByLabel('Descanso em segundos').nth(0).fill('5');
await page.getByLabel('Carga inicial').nth(0).fill('60');
// reorder: move second up
await page.getByLabel('Mover para cima').nth(1).click();
await page.getByLabel('Mover para baixo').nth(0).click();
await shot('02-routine-editor');
await page.getByRole('button', { name: /Salvar/ }).click();
await page.getByText('Rotina criada').waitFor();
await page.getByRole('heading', { name: 'Push A' }).waitFor();

step('duplicate + delete');
await page.getByRole('button', { name: /Duplicar/ }).click();
await page.getByText('Rotina duplicada').waitFor();
await page.goBack();
await page.getByLabel('Excluir Push A (cópia)').click();
await page.getByRole('button', { name: 'Excluir', exact: true }).click();
await page.getByText('Rotina excluída').waitFor();

step('weekly schedule');
await page.getByRole('tab', { name: 'Semana' }).click();
const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
await page.getByLabel(`Treino de ${days[new Date().getDay()]}`).selectOption({ label: 'Push A' });
await page.getByText('1 dia de treino').waitFor();

step('start workout from dashboard');
await page.getByRole('link', { name: 'Início' }).last().click();
await page.getByText('Treino de hoje').waitFor();
await page.getByRole('button', { name: /Iniciar treino/ }).first().click();
await page.getByText('Exercício 1 de 2').waitFor();
await page.getByRole('heading', { name: 'Supino reto com barra' }).waitFor();
const w0 = await page.getByLabel('Carga da série 1').inputValue();
if (w0 !== '60') throw new Error('initial load not applied: ' + w0);
await page.getByLabel('Repetições da série 1').fill('10');
await page.getByLabel('Concluir série 1').click();
step('rest timer');
await page.getByRole('timer').waitFor();
await page.getByRole('button', { name: 'Pausar', exact: true }).click();
await page.getByText('Pausado').waitFor();
await page.getByLabel('Adicionar 15 segundos').click();
await page.getByRole('button', { name: 'Retomar', exact: true }).click();
await page.getByLabel('Remover 15 segundos').click();
await shot('03-rest-timer');
// wait for natural finish (5s)
await page.getByText('Descanso concluído').waitFor({ timeout: 10000 });
await page.getByRole('button', { name: /Próxima série/ }).click();

step('persistence on reload');
await page.getByLabel('Carga da série 2').fill('62,5');
await page.getByLabel('Repetições da série 2').fill('8');
await page.waitForTimeout(300);
await page.reload();
await page.getByLabel('Carga da série 2').waitFor();
if ((await page.getByLabel('Carga da série 2').inputValue()) !== '62,5') throw new Error('weight not persisted');
await page.getByLabel('Concluir série 2').click();
await page.getByRole('button', { name: /Pular descanso/ }).click();
await page.getByText('Exercício 2 de 2').waitFor(); // auto-advanced
await page.getByLabel('Carga da série 1').fill('10');
await page.getByLabel('Repetições da série 1').fill('15');
await page.getByLabel('Concluir série 1').click();
await page.getByRole('button', { name: /Adicionar série/ }).click();
await page.getByLabel('Repetições da série 2').fill('12');
await shot('04-active-workout');
await page.getByLabel('Concluir série 2').click();
if (await page.getByRole('timer').isVisible()) await page.getByRole('button', { name: /Pular descanso/ }).click();

step('finish');
await page.getByRole('button', { name: /Finalizar treino/ }).click();
await page.getByRole('dialog').getByRole('button', { name: 'Finalizar' }).click();
await page.getByText('Treino concluído').waitFor();
await page.getByText('Primeira vez realizando este treino').waitFor();
await shot('05-summary');
await page.getByRole('button', { name: 'Concluir' }).click();
await page.getByText('Último treino').waitFor();
await shot('06-dashboard');

step('second workout → PR + comparison');
await page.getByText(/Próximo treino/).waitFor();
await page.getByRole('button', { name: /Iniciar treino/ }).first().click();
await page.getByText('Exercício 1 de 2').waitFor();
await page.getByText(/Tente|Mantenha/).waitFor(); // progression suggestion
await page.getByLabel('Carga da série 1').fill('65');
await page.getByLabel('Repetições da série 1').fill('10');
await page.getByLabel('Concluir série 1').click();
await page.getByRole('button', { name: /Pular descanso/ }).click();
await page.locator('.workout-top').getByRole('button', { name: 'Finalizar' }).click();
await page.getByText(/não foram concluídas|não foi concluída/).waitFor();
await page.getByRole('dialog').getByRole('button', { name: 'Finalizar' }).click();
await page.getByText('Recordes pessoais').first().waitFor();
await page.getByText('Comparação com o último treino').waitFor();
await page.getByRole('button', { name: 'Concluir' }).click();

step('history');
await page.goto(BASE + '/#/historico');
await page.getByText('2 treinos registrados').waitFor();
await page.getByRole('link', { name: /Push A/ }).first().click();
await page.getByText('65 kg × 10').waitFor();

step('progress + records');
await page.goto(BASE + '/#/recordes');
await page.getByRole('link', { name: /Supino reto com barra/ }).click();
await page.getByText('Comparação entre sessões').waitFor();
await shot('07-progress');

step('exercises library');
await page.goto(BASE + '/#/exercicios');
await page.getByLabel('Buscar exercícios').fill('rosca');
await page.getByRole('button', { name: 'Bíceps' }).click();
await page.getByRole('link', { name: /Rosca martelo/ }).click();
await page.getByText('Erros comuns').waitFor();
await page.getByRole('button', { name: /Vincular/ }).click();
await page.getByLabel('Link do vídeo').fill('https://bad.example.com/x');
await page.getByRole('button', { name: 'Salvar' }).click();
await page.getByText(/Use um link HTTPS/).waitFor();
await page.getByRole('button', { name: 'Fechar' }).click();
await shot('08-exercise');

step('reports + exports');
await page.goto(BASE + '/#/relatorios');
await page.getByText('Frequência por grupo muscular').waitFor();
for (const p of ['7d', '90d', '6m', '1a', '30d']) await page.getByRole('tab', { name: p }).click();
await page.getByRole('tab', { name: 'Data' }).click();
await shot('09-reports');
const [pdf] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Relatório PDF/ }).click()]);
const [csv] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Séries \(CSV\)/ }).click()]);
console.log('downloads:', pdf.suggestedFilename(), csv.suggestedFilename());

step('profile + body weight');
await page.goto(BASE + '/#/perfil');
await page.getByRole('button', { name: /Registrar/ }).click();
await page.getByRole('button', { name: 'Salvar' }).click();
await page.getByText(/Informe um peso/).waitFor();
await page.getByLabel('Peso (kg)').fill('82,4');
await page.getByRole('button', { name: 'Salvar' }).click();
await page.getByText('Peso registrado').waitFor();
await page.getByLabel('Editar perfil').click();
await page.getByLabel('Altura (cm)').fill('180');
await page.getByRole('button', { name: 'Salvar' }).click();
await page.getByText('Perfil atualizado').waitFor({ timeout: 4000 }).catch(async (e) => { await shot('err-profile'); throw e; });
await page.getByText(/IMC/).waitFor();
const [bk] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Exportar backup/ }).click()]);
console.log('backup:', bk.suggestedFilename());
await shot('10-profile');

step('offline');
await page.goto(BASE + '/#/');
await page.waitForTimeout(1500); // let SW install/claim
await ctx.setOffline(true);
await page.reload();
await page.getByText('Último treino').waitFor();
await page.getByText(/Offline/).waitFor();
await ctx.setOffline(false);

step('desktop layout');
await page.setViewportSize({ width: 1280, height: 800 });
await page.goto(BASE + '/#/relatorios');
await page.locator('.sidebar').waitFor();
await shot('11-desktop');

await browser.close();
if (errors.length) { console.error('ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('E2E OK');
