# FDV — App de gestão de time de futebol

App mobile-first, tema escuro com verde de campo, acesso só por código de convite, gerido por 1 admin.

## Observações importantes antes de começar

1. **Stack real do template**: este projeto usa **TanStack Start (React 19 + Vite 7 + Tailwind v4 + shadcn)** e **Lovable Cloud** (Supabase gerido por baixo). Não usaremos Vercel nem GitHub manualmente — o deploy é feito pelo botão **Publish** do Lovable, que entrega a URL `.lovable.app` (com suporte a domínio custom). Tudo o que você pediu para Supabase funciona igual.

2. **PWA dentro do preview do Lovable**: service workers causam problemas sérios no preview em iframe (cache obsoleto, navegação quebrada). Vou implementar PWA **só com `manifest.json` + ícones + `display: standalone`** — isso já torna o app instalável no iOS e Android ("Adicionar à tela inicial") sem precisar de service worker. **Sem service worker = sem cache offline real**, mas o app abre instalado em tela cheia. Se você quiser offline de verdade depois, ativamos `vite-plugin-pwa` com guards anti-iframe (mais frágil no preview).

3. **Autenticação por código de convite**: como não há e-mail/senha do Supabase Auth, vou modelar a sessão como um **device token** armazenado em `localStorage` + linha em `player_sessions` no banco. RLS usa esse token via header customizado em todas as queries (não é Supabase Auth nativo). Para o admin único, vou criar 1 código admin inicial que você usa para se registrar como `is_admin = true`.

## Banco (Lovable Cloud / Postgres)

Tabelas exatamente como pedido: `invite_codes`, `players`, `games`, `locations`, `confirmations`, `payments` + `player_sessions` (token de dispositivo). Mais um enum `position` (goleiro/defensor/meio/atacante) e enums de status. RLS habilitado em todas, com função `current_player_id()` que lê o token via `request.header`.

Realtime ligado em `confirmations`, `payments`, `games`.

Storage bucket público `avatars` para fotos de perfil e `fields` para fotos dos campos.

## Telas (rotas TanStack)

**Públicas**
- `/` → splash + input de código de convite
- `/onboarding` → criar perfil (foto, nome, posição)
- `/suspended` → tela de acesso bloqueado

**Autenticadas (layout `_app` com bottom nav)**
- `/app` → Home (próximo jogo, confirmar, pagamento, campo, confirmados)
- `/app/jogos` + `/app/jogos/$id`
- `/app/campos`
- `/app/pagamentos`
- `/app/perfil`

**Admin (layout `_admin`, só `is_admin`)**
- `/admin` → dashboard
- `/admin/jogadores` + detalhe
- `/admin/codigos` (gerar/revogar)
- `/admin/jogos` + criar/editar/detalhe com pagamentos
- `/admin/campos` (CRUD)

## Componentes-chave

`BottomNav`, `PlayerAvatar` (com fallback iniciais), `GameCard`, `PaymentBadge`, `StatusBadge`, `ConfirmButton`, `PullToRefresh`, `FieldCard`, `AdminGuard`, `SessionProvider`.

## Design system (em `src/styles.css`)

- Dark mode default, tokens em `oklch`
- `--primary` verde campo (~`oklch(0.72 0.19 145)`)
- `--background` zinc-950, `--card` zinc-900, `--border` zinc-800
- Cards `rounded-2xl`, badges coloridos por status
- `framer-motion` para transições, `sonner` para toasts

## Server functions

- `redeemInviteCode`, `createProfile`, `getSession`, `logout`
- `confirmPresence`, `cancelPresence`
- Admin: `generateInviteCode`, `revokeCode`, `blockPlayer`, `createGame`, `updateGame`, `markPayment`, `createField`

Tudo com `requireSession` middleware (valida device token), e checks de `is_admin` para rotas admin.

## Fora do escopo desta primeira entrega

- Service worker / offline real (ver nota 2)
- Light mode (deixo o toggle pronto mas dark como default)
- Push notifications

## Perguntas rápidas antes de começar

1. **Código admin inicial**: posso criar um código fixo tipo `FDV-ADMIN-2026` que você usa uma vez para criar seu perfil como admin? (Depois é destruído.)
2. **Valor padrão de contribuição por jogo**: define ao criar cada jogo, ou tem valor fixo do time?
3. **PWA**: confirma que está OK começar com manifest-only (instalável, sem offline)?

Se responder "pode tocar", assumo: (1) sim código admin fixo, (2) valor por jogo, (3) manifest-only.