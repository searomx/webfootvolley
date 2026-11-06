# Footvolley 2026 — inscrição de atletas

Aplicação de página única para a competição de 28 e 29 de novembro de 2026.
Next.js, React, shadcn/ui (Radix), Zustand 5, React Hook Form, Zod, Prisma 7
e PostgreSQL 18.6. Foram usadas versões estáveis: PostgreSQL 19 e Prisma 8
ainda são pré-lançamentos no momento da implementação.

## Executar localmente

Requisitos: Node.js 24, npm e Docker com Compose.

```bash
npm install
npm run setup:local
docker compose up --detach --wait
npm run db:migrate
npm run dev
```

Abra <http://localhost:3000>. Use **`npm run dev`**, não `npx run dev`.
`setup:local` cria `.env` com uma senha aleatória para o banco local, sem
sobrescrever arquivos existentes. Se `.env` já existe, revise sua configuração
em vez de executar novamente esse comando.

O PostgreSQL é exposto somente em `127.0.0.1:5433`, usa autenticação
SCRAM-SHA-256 e preserva dados em volume Docker. Para parar sem apagar
dados: `docker compose stop`.

Para usar um PostgreSQL existente, configure `DATABASE_URL` e execute
`npm run db:migrate` somente no banco destinado a esta aplicação.
Não há reset automático.

Para diagnosticar HTTP 500 em produção, consulte os logs de `/api/registrations`.
Erros conhecidos do Prisma registram o código (por exemplo, `P2021` para tabela
ausente ou `P2022` para coluna ausente), sem registrar a mensagem completa,
credenciais ou dados do formulário. Confirme que as migrações foram aplicadas
ao mesmo banco definido em `DATABASE_URL` no ambiente Production da Vercel.

As variáveis `POSTGRES_USER`, `POSTGRES_DB` e `POSTGRES_PASSWORD` do Docker
só inicializam um volume vazio. Alterá-las no `.env` não cria usuários,
bancos nem muda senhas em volumes existentes, mesmo ao recriar o container.
Nesse caso, crie o usuário/banco no PostgreSQL ou ajuste `DATABASE_URL`
para as credenciais existentes. Não apague o volume para resolver P1000.

`npx prisma migrate dev` cria um shadow database temporário e exige
`CREATEDB` no usuário PostgreSQL de desenvolvimento. Se ocorrer P3014,
um administrador deve conceder essa permissão apenas no ambiente local
ou configurar um banco shadow separado. Não conceda superusuário para isso.
Para aplicar migrations existentes, use `npm run db:migrate`
(`prisma migrate deploy`), que não precisa de shadow database.

O vínculo `Registration.pairOfPlayersId` com `PairOfPlayers.id` usa colunas
`TEXT` nos dois lados. A dupla é opcional no cadastro atual; inscrições
existentes permanecem sem vínculo após a migração.
Novos parceiros são associados por inscrição e categoria em
`PairOfPlayers.registrationId` e `categoryId`, sem modificar o vínculo legado.
`player1Id` armazena o nome informado do parceiro, não um ID de usuário.

## Configurar Pix e envio de PDF

Consulte [`.env.example`](./.env.example). Configure as variáveis no `.env`
ou no ambiente de implantação. Next.js dá prioridade ao `.env.local`,
quando presente. A chave Pix e o destinatário fornecidos pelo solicitante
estão somente na configuração local ignorada pelo Git.

| Variável | Uso |
|---|---|
| `DATABASE_URL` | URL PostgreSQL com usuário, senha codificada para URL e banco |
| `PIX_KEY` | Chave Pix do recebedor |
| `PIX_MERCHANT_NAME` | Nome real do recebedor, máximo de 25 caracteres após normalização |
| `PIX_MERCHANT_CITY` | Cidade real do recebedor, máximo de 15 caracteres após normalização |
| `REGISTRATION_EMAIL` | E-mail da organização, destinatário fixo do PDF |
| `SMTP_HOST`, `SMTP_PORT` | Servidor e porta SMTP |
| `SMTP_SECURE` | `true` para TLS direto, normalmente 465; `false` para STARTTLS, normalmente 587 |
| `SMTP_USER`, `SMTP_PASS` | Credenciais SMTP; para Gmail, use senha de app quando disponível |
| `SMTP_FROM` | E-mail remetente autorizado pelo provedor |
| `APP_ORIGIN` | Origem pública exata, sem barra final, usada para validar requisições |
| `TRUST_PROXY` | `true` somente quando o proxy sobrescreve `x-forwarded-for` |

Nome e cidade Pix são normalizados para maiúsculas sem acentos, mas não
truncados. Configurações ausentes ou inválidas produzem erro explícito.
Nunca coloque credenciais em variáveis `NEXT_PUBLIC_*` ou arquivos versionados.
Reinicie o servidor após alterar a configuração.

Em produção, SMTP exige TLS/STARTTLS com certificado válido. A fonte Noto Sans
usada no PDF está incluída no rastreamento de arquivos do Next.js.

## Fluxo e regras

- Apelido e etapas são opcionais. Os demais dados e pelo menos uma categoria
  são obrigatórios. Nascimento: data válida de 1900 até hoje.
- Uma categoria custa R$ 60,00. Cada adicional soma R$ 40,00:
  duas custam R$ 100,00 e todas as oito custam R$ 340,00.
- O servidor valida os dados e calcula o preço em centavos. Não aceita
  totais do cliente, categorias desconhecidas ou duplicadas.
- A seleção atualiza QR Code Pix estático e código copia e cola.
- Cada categoria marcada exibe à direita um campo opcional de nome do parceiro.
  Em celular, o campo pode quebrar para a próxima linha. Desmarcar remove o
  nome daquela categoria. Os nomes são salvos e incluídos por categoria no PDF.
- O envio registra a inscrição no PostgreSQL e gera um PDF anexado ao
  e-mail da organização. Não envia ao e-mail do atleta.
- **O pagamento permanece pendente.** QR Code estático não verifica
  pagamento e o PDF não é comprovante.
- Falhas SMTP preservam a inscrição e permitem retry pelo mesmo botão,
  sem duplicar o cadastro. Campos ficam bloqueados após iniciar o envio
  para preservar a mesma operação, inclusive em falhas de comunicação.
  Rejeições definitivas do servidor, como HTTP 400/409, liberam os campos
  para correção mantendo o protocolo. HTTP 408/429, falhas de rede e respostas
  incertas mantêm os dados da tentativa para retry seguro. Há tempo limite
  de resposta de 55 segundos, sem cancelar o cadastro já iniciado no servidor.
- Dados pessoais não são salvos no armazenamento do navegador. Somente
  o protocolo opaco é preservado em sessionStorage, inclusive ao recarregar
  a mesma aba. Preencha novamente os mesmos dados para recuperar a operação.
  Após o envio confirmado, use "Cadastrar outro atleta" para iniciar uma
  operação nova. Fechar a aba perde esse protocolo.
- `SENT` significa aceitação pelo servidor SMTP, não garantia de entrega
  na caixa de entrada. Confira spam e regras do provedor.
- Há reserva temporária para evitar envios concorrentes. Falha do processo
  depois da aceitação SMTP e antes da atualização do banco pode causar
  reenvio. O `Message-ID` permanece estável, mas entrega exatamente uma vez
  não pode ser garantida por SMTP.

Requisições de cadastro têm limite de 16 KiB e limitação de 30 tentativas
por minuto em PostgreSQL. Sem proxy confiável, o limite é global; com
`TRUST_PROXY=true`, é por endereço encaminhado. Não confie em cabeçalhos
públicos. Há validação de origem e campo antispam invisível.

## Validar

```bash
npm test
npm run test:integration
npm run typecheck
npm run lint
npm run build
```

Os testes de integração criam um container PostgreSQL isolado, com senha e
porta aleatórias, aplicam migrations e usam SMTP local com dados fictícios.
O container é removido no final; nenhum e-mail real é enviado. Os testes
validam persistência, PDF, preço, reenvio, concorrência e erros de entrada.
Os testes Pix decodificam as imagens QR geradas e conferem valores e CRC.

Produção:

```bash
npm run db:migrate
npm run build
npm start
```

Configure HTTPS, banco persistente e SMTP antes de disponibilizar inscrições.
Estabeleça com a organização política de privacidade, acesso e retenção dos
dados pessoais; esta versão não inclui painel administrativo.
