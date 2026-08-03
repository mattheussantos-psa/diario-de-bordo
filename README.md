# Diário de Bordo — Closers

Painel diário dos closers (B2B/B2C) da PSA. Mostra os negócios **ativos no funil**
com 5 colunas — **Nome do negócio, Etapa atual, Próxima atividade, Ação que será
feita, Observação** — puxados do HubSpot e vinculados ao usuário do closer.

## Status

**Mockup navegável.** Layout, marca (fonte Bruta Pro, cores `#f46411` / `#183caa`
sobre fundo branco) e as 5 colunas já definidos e validados. Ainda sem backend:
os 6 negócios visíveis são de exemplo; em produção a lista virá completa do HubSpot.

Escopo atual: closer **Rafael Teixeira** (`ownerId 80454586`), segmento **B2B**.
Login e visão de admin (todos os closers / ambos os segmentos) ficam para depois.

## Como gerar o `index.html`

O `index.html` é autocontido (fonte, logo e foto embutidos como data URI).
Para regerar após editar `src/template.html` ou trocar um asset:

```bash
node src/build.mjs
```

Depois é só abrir `index.html` no navegador.

## Estrutura

```
index.html            # mockup gerado (autocontido) — NÃO editar à mão
src/template.html     # HTML+CSS fonte (usa placeholders __FONT__/__PSA__/__PFP__)
src/build.mjs         # embute os assets e gera ../index.html
src/assets/           # fonte Bruta Pro, logo PSA, avatar do closer
```

## Decisões pendentes (definem o backend)

1. **Onde gravar "Ação" e "Observação"** — banco próprio (recomendado p/ começar)
   ou write-back no HubSpot (mudar etapa/propriedade do negócio).
2. **Lista longa** — paginação ou rolagem infinita.
3. **Fonte de "próxima atividade"** — `hs_next_activity_date` não veio populada
   nesta conta; provavelmente derivar das tarefas/atividades abertas do negócio.
4. **Fotos dos closers** — HubSpot não expõe o avatar pela API pública; guardamos
   uma foto por closer do nosso lado (feito para o Rafael).
