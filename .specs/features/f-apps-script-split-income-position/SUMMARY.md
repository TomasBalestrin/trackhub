# Apps Script — separar income/position quando concatenados

**Date:** 2026-04-13
**Status:** ✅ Helper adicionado nos 2 Apps Scripts ativos + 10 leads existentes backfillados no DB.
**Reference:** AD-006 (regra de qualificação), L-004 (bug de mapeamento do Apps Script)

## Problem

Em **10 de 81 leads** (~12%), o campo `monthly_income` chegou no banco concatenado com `position` — ex: `"Entre R$15.000 e R$30.000 Vendedor"` — com `position` NULL. Causa provável: alguma coluna da planilha (possivelmente `location`, mapeada para `monthly_income` no fieldMap do Apps Script) mistura as duas informações.

Usuário confirmou que **não pode modificar o formato das colunas da planilha** — o fix precisa acontecer no código dos Apps Scripts, não na origem dos dados.

## Approach

Adicionar helper `splitIncomePosition(lead)` no topo de cada Apps Script ativo em `public/`. Chamado logo após o `lead.source = SOURCE;`, antes do push pra queue de envio.

Comportamento:
1. Se `lead.monthly_income` termina com um dos cargos conhecidos **E** `lead.position` está vazio/undefined, separa os dois campos.
2. Usa regex `\s+<SUFFIX>\s*$` case-insensitive pra matching de word boundary no final.
3. Lista de cargos conhecidos (`POSITION_SUFFIXES`) cobre os padrões observados + variações ortográficas comuns: Dono, Sócio/Socio, Vendedor, Colaborador, CEO, Gerente, Diretor, Gestor, Empreendedor, Profissional, Funcionário/Funcionario, Autônomo/Autonomo.

## Files Changed

- `public/script-mentoria-aovivo-2.js`:
  - Constante `POSITION_SUFFIXES` + função `splitIncomePosition` no topo
  - Chamada em `onSheetChange` (fluxo automático) **e** em `enviarTodosLeads` (importação manual)
- `public/script-mentoria-aovivo-3.js`: mesmo patch

`public/google-apps-script.js` ficou como estava — verificar se ainda está em uso.

## Backfill executado

Script Node one-off (deletado após execução) usou a mesma lógica do helper e aplicou:

```
3ea190d1  "Acima de R$1.000.000 Colaborador" → income="Acima de R$1.000.000", position="Colaborador"
3ce32163  "Entre R$15.000 e R$30.000 Dono"   → income="Entre R$15.000 e R$30.000", position="Dono"
53b9a3ee  "Até R$15.000 Dono"                → income="Até R$15.000", position="Dono"
c0de4f24  "Entre R$30.000 e R$100.000 Sócio" → income="Entre R$30.000 e R$100.000", position="Sócio"
4abd4645  "Até R$15.000 Dono"                → income="Até R$15.000", position="Dono"
19be9b8f  "Até R$15.000 Dono"                → income="Até R$15.000", position="Dono"
82b4cec2  "Entre R$15.000 e R$30.000 Vendedor" → income="Entre R$15.000 e R$30.000", position="Vendedor"
aed62e2c  "Entre R$15.000 e R$30.000 Vendedor" → income="Entre R$15.000 e R$30.000", position="Vendedor"
973221e2  "Até R$15.000 Dono"                → income="Até R$15.000", position="Dono"
0718d59d  "Até R$15.000 Sócio"               → income="Até R$15.000", position="Sócio"
```

10/10 atualizados com sucesso.

## Passos manuais para você aplicar (fora do repositório)

O código em `public/` é apenas a versão de referência; os scripts que rodam em produção estão nos projetos Apps Script do Google atrelados a cada planilha. Para ativar o fix em novos leads:

1. Abrir [script.google.com](https://script.google.com) e localizar o projeto vinculado à planilha da **Mentoria ao Vivo 2**
2. Substituir o conteúdo atual pelo novo `public/script-mentoria-aovivo-2.js`
3. Salvar (Ctrl+S) — o gatilho existente continua valendo
4. Repetir os passos 1-3 para **Mentoria ao Vivo 3** com `public/script-mentoria-aovivo-3.js`
5. Teste: enviar um lead de formulário com campo que combine faturamento+cargo e conferir que no `/admin/leads` os dois campos vêm separados

## Observações

- **Bug não resolvido:** `"Entre R$100.000 e R$50.000"` (1 lead) — teto menor que piso. Isso é erro de input na planilha (provavelmente "R$100.000 - R$500.000" digitado errado). Helper não toca nesses — requer correção manual se quiser.
- **Campo `location` do fieldMap**: estranhamente mapeia para `monthly_income`. Se algum dia uma coluna "location" aparecer de verdade (cidade), vai poluir monthly_income. Vale revisar junto com o time quando houver oportunidade.
- **Lista de cargos `POSITION_SUFFIXES`**: se surgirem novos cargos ("CMO", "Mentor", etc.), adicionar à lista em ambos scripts.
