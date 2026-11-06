# Revisão focada da página de inscrição

## Contexto

A página já contém um campo de telefone em andamento e o modelo Prisma local
também declara esse dado, mas o schema compartilhado de validação, a migração
SQL e o PDF ainda não o contemplam. Isso deixa o tipo do formulário inconsistente
e faz o typecheck falhar. Os requisitos existentes não tornam telefone
obrigatório.

## Escopo aprovado

- Manter a estrutura, o cartaz e o layout visual existentes.
- Completar o fluxo do telefone como campo opcional.
- Corrigir o título para “Liga Interna de Futevôlei — 3ª etapa — Contorno da
  Bola”.
- Atualizar testes diretamente relacionados ao schema, formulário e PDF.

Não faz parte do escopo um redesign, máscara/formatação automática de telefone,
mudança nas regras de inscrição, nem correção do erro de lint preexistente em
`src/lib/prisma.ts`.

## Comportamento e dados

O formulário apresentará “Telefone (opcional)”, usará `type="tel"` e
`autocomplete="tel"` e aceitará o campo vazio. O valor informado seguirá o
limite de 20 caracteres já indicado pelo formulário; não será aplicada máscara
nem validação restrita a um formato nacional.

O schema Zod compartilhado aceitará o valor vazio e validará o limite e os
caracteres permitidos. A camada de persistência converterá valor vazio em
`null`. O campo Prisma será nullable, compatível com inscrições já existentes.
Uma nova migração adicionará a coluna opcional, sem reescrever a migração
anterior nem preencher retroativamente dados pessoais.

O PDF mostrará o telefone informado ou “Não informado”. Os dados continuam
limitados aos usos já descritos no produto; não serão acrescentados logs com
dados pessoais.

## Verificação

- Typecheck do projeto para confirmar a tipagem completa do formulário.
- Testes do schema com telefone vazio, válido e acima do limite.
- Teste do formulário confirmando rótulo opcional e envio consistente.
- Teste do PDF para telefone informado e ausente.
- Testes focados do fluxo de inscrição afetado.

O lint será verificado, mas um erro existente em `src/lib/prisma.ts` não será
alterado como parte desta revisão.
