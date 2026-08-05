# Diário de Bordo — Closers

Painel diário dos closers (B2B/B2C) da PSA. Lista os **negócios ativos no funil**
do HubSpot (vinculados ao closer logado) em 5 colunas — **Nome, Etapa atual,
Próxima atividade, Evolução buscada, Observação** — e grava as duas últimas de
volta no HubSpot. **Sem banco de dados**: o HubSpot é a única fonte da verdade.

- **Evolução buscada** → propriedade `temperatura_atual` do negócio (opções puxadas
  ao vivo do HubSpot).
- **Observação** → propriedade `observacoes` do negócio.

## Stack

Next.js (App Router) · Auth.js (NextAuth v5, login Google) · HubSpot API v3 · deploy na Vercel.

## Autenticação

Login via Google restrito ao domínio `@profissionaissa.com`. O e-mail é casado com
o **owner do HubSpot**, e o painel mostra só os negócios daquele closer, no segmento
dele. Admins (ver `lib/config.js`) enxergam todos — visão de admin ainda a construir.

## Variáveis de ambiente

Ver `.env.example`. Em produção, configurar na Vercel:

| Variável | O que é |
|---|---|
| `HUBSPOT_TOKEN` | Token do App Privado do HubSpot (deals read+write, owners read) |
| `AUTH_SECRET` | Segredo do NextAuth (`npx auth secret`) |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Credencial OAuth 2.0 (Aplicativo da Web) |
| `ADMIN_EMAILS` | (opcional) CSV que sobrescreve os admins padrão |

**Redirect URI do Google** (colar no Console): `https://SEU-DOMINIO/api/auth/callback/google`
e, para dev, `http://localhost:3000/api/auth/callback/google`.

## Rodar local

```bash
npm install
cp .env.example .env.local   # preencher os valores
npm run dev
```

## Estrutura

```
app/page.js                 painel (server): resolve owner, busca negócios, renderiza
app/DealsTable.js           tabela (client): edição de evolução/observação + salvar
app/login/page.js           tela de login Google
app/api/deals/[id]/route.js PATCH: grava temperatura_atual + observacoes no HubSpot
app/api/auth/[...]          handlers do NextAuth
auth.js                     config do NextAuth (Google, domínio, admin)
middleware.js               exige login em / e /api/deals
lib/hubspot.js              chamadas ao HubSpot (usa HUBSPOT_TOKEN)
lib/config.js               domínio, admins, pipelines, estilos, avatares
public/                     fonte Bruta Pro, logo PSA, avatares dos closers
```

## Pendências

- **"Fechar"** como evolução: indefinido (mudar etapa p/ Ganho vs. nova opção de temperatura). Fora por ora.
- **Descrição da próxima atividade**: hoje só a data (`hs_next_activity_date`); o tipo/assunto da tarefa depende de sincronização adicional no HubSpot.
- **Visão de admin** (todos os closers / ambos os segmentos): estrutura pronta (flag `isAdmin`), UI a construir.
- **Foto dos closers**: uma imagem por e-mail em `public/avatars/` (HubSpot não expõe via API).
