# Setly Gym

Aplicativo web (PWA) de musculação focado em hipertrofia: rotinas, treino ativo com cronômetro de descanso, progressão de cargas, recordes pessoais e relatórios. Mobile first, funciona offline e está pronto para ser empacotado pelo [PWABuilder](https://www.pwabuilder.com).

## Funcionalidades

- **Início** — saudação, semana atual, treinos/tempo/volume da semana, sequência, último e próximo treino, frequência das últimas 8 semanas, recordes recentes.
- **Treinos** — rotinas ilimitadas (criar, editar, duplicar, excluir, reordenar exercícios, séries, faixa de reps, carga inicial, descanso, observações), divisões prontas (ABC, ABCD, ABCDE, PPL, Upper/Lower, Full Body) e programação semanal.
- **Treino ativo** — tela própria sem navegação, tempo decorrido (com pausa), exercício atual/próximo, séries feitas/restantes, coluna "anterior", histórico do exercício, sugestão de progressão dupla, observações por série, adicionar/remover/substituir/reordenar exercícios e séries. Descanso automático com pausar, retomar, ±15 s, pular, alerta sonoro, vibração e visual. Salvamento automático a cada alteração (IndexedDB) — fechar o app não perde nada.
- **Resumo final** — duração, exercícios, séries, reps, volume, recordes batidos e comparação com a sessão anterior da mesma rotina.
- **Exercícios** — 90 exercícios em 11 grupos com nome PT/EN, músculos principal/secundários (mapa anatômico), equipamento, tipo, execução, dicas, erros comuns e observações. Busca, filtros e exercícios personalizados.
  - *Vídeos:* o app não inventa links. Cada exercício tem busca direta no YouTube e o usuário pode vincular um vídeo confiável (YouTube, Vimeo ou .mp4 HTTPS), que passa a ser exibido embutido.
- **Progressão** — por exercício: carga máxima, 1RM estimado (Epley), volume e reps ao longo do tempo; detecção de aumento de carga, de repetições, de volume e de períodos sem progressão.
- **Relatórios** — 7/30/90 dias, 6 meses, 1 ano ou período personalizado; comparação com o período anterior; volume/reps/frequência/tempo, progressão de carga, séries por grupo muscular. Exporta **PDF** e **CSV** (treinos e séries).
- **Histórico**, **Recordes** (maior carga, mais reps, maior volume por série e por exercício, com histórico) e **Perfil** (foto, idade, altura, peso com gráfico, objetivo, nível, início dos treinos, preferências, backup/restauração).

Nenhum dado de exemplo é exibido como se fosse do usuário: tudo é calculado a partir dos registros.

## Tecnologia

React 19 + TypeScript + Vite · Dexie (IndexedDB) · vite-plugin-pwa (Workbox) · gráficos SVG próprios · jsPDF · Supabase (opcional).

```
src/
  db/          tipos, schema Dexie e repositório (única camada que escreve dados)
  data/        biblioteca de exercícios, divisões prontas, rótulos
  lib/         lógica pura: analytics (recordes/progressão), stats, export, sync, datas, formatação
  hooks/       consultas reativas, cronômetro de descanso
  components/  UI reutilizável, gráficos, mapa muscular, layout
  pages/       telas
```

## Desenvolvimento

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # testes unitários + fluxo completo em IndexedDB
npm run build      # gera dist/ (com service worker e manifest)
npm run preview    # serve dist/ em http://localhost:4173
node tests/e2e.mjs http://localhost:4173   # teste ponta a ponta (Playwright)
```

Scripts auxiliares: `npm run icons` (ícones + splash iOS) e `node scripts/screenshots.mjs <url-do-dev-server>` (capturas para a loja, usando dados de demonstração num navegador descartável).

## Publicação e PWABuilder

1. `npm run build` e publique a pasta `dist/` em qualquer hospedagem estática com HTTPS (Vercel, Netlify, Cloudflare Pages, GitHub Pages na raiz do domínio). As rotas usam hash (`/#/...`), então não é preciso configurar rewrites.
2. Abra o PWABuilder, informe a URL publicada e gere os pacotes (Android/TWA, iOS, Windows). Manifest (ícones `any`/`maskable`/`monochrome`, screenshots, atalhos, `id`, `display_override`) e service worker já atendem aos requisitos.
3. Para Android, adicione o `assetlinks.json` fornecido pelo PWABuilder em `public/.well-known/` e publique novamente.

## Sincronização em nuvem (opcional)

Sem configuração o app funciona 100% local. Para login e sincronização entre aparelhos:

1. Crie um projeto Supabase e execute `supabase/schema.sql`.
2. Copie `.env.example` para `.env` e preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
3. Rode `npm run build`. A seção **Perfil → Conta e sincronização** passa a oferecer login. Os dados continuam sendo gravados localmente primeiro (offline) e são sincronizados ao entrar, ao finalizar treinos e quando a conexão volta (last-write-wins por registro, exclusões propagadas).
