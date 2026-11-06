# Inscrição para competição de footvolley

## Escopo aprovado

Aplicação Next.js com uma única página pública, em português do Brasil,
responsiva e acessível. O header usa `/images/img_footvolley.svg`, servido
de `public/images/img_footvolley.svg`.

O formulário usa shadcn/ui, React Hook Form e Zod. Zustand, na versão estável
atual no momento da implementação, será inicializado por provider para o
estado transitório de categorias e resumo de pagamento. Dados pessoais não
serão persistidos no navegador.

## Formulário

- Nome completo, apelido, endereço, onde treina, data de nascimento e e-mail.
- Nome, endereço, local de treino, nascimento e e-mail obrigatórios.
- Apelido opcional; limites de tamanho serão compartilhados pelo cliente e servidor.
- Nascimento deve ser uma data válida, não futura; não há restrição etária definida.
- Etapas da liga interna de 2026: Primeira, Segunda e Terceira, com
  checkboxes independentes. Nenhuma seleção é permitida para quem não participou.
- Categorias com seleção múltipla; pelo menos uma é obrigatória.

| Data | Horário | Categoria |
|---|---|---|
| 28/11/2026 | 09h | Masculino C |
| 28/11/2026 | 12h | Masculino B |
| 28/11/2026 | 13h | Masculino A |
| 28/11/2026 | 15h | Misto B |
| 29/11/2026 | 09h | Feminino C |
| 29/11/2026 | 11h | Feminino B |
| 29/11/2026 | 12h | Feminino A |
| 29/11/2026 | 13h30 | Misto A |

Não impor exclusividade entre categorias: o pedido permite múltiplas seleções.
O botão envia o formulário e informa processamento, erros e resultado.

## Preço e Pix

Usar centavos inteiros: zero seleções não permite inscrição nem gera Pix;
de uma a oito categorias, o total é `6000 + (quantidade - 1) * 4000`.

Totais obrigatórios: R$ 60, R$ 100, R$ 140, R$ 180, R$ 220, R$ 260,
R$ 300 e R$ 340. O servidor calcula o valor, sem confiar no total do cliente.

Gerar Pix estático no padrão BR Code, com CRC válido, chave configurada
no servidor, nome e cidade do recebedor e valor correspondente. Exibir QR
Code e copia e cola atualizados conforme a seleção. A chave fornecida será
configurada fora de arquivos versionados. Nome e cidade do recebedor ainda
precisam ser fornecidos na configuração real; não usar dados fictícios.

Pix estático não confirma pagamentos automaticamente. A inscrição e o PDF
sempre indicam **pagamento pendente**, conforme escolha aprovada pelo usuário.

## Persistência e envio

Prisma ORM com PostgreSQL na versão estável atual, usando usuário e senha
via `DATABASE_URL`. Oferecer configuração local reproduzível e migrations,
sem executar comandos destrutivos em bancos existentes.

O modelo armazena identificador da inscrição, dados do formulário, etapas,
categorias, total em centavos, status de pagamento, status de envio do PDF
e datas de criação/atualização.

Ao enviar:

1. Validar entrada no servidor com Zod.
2. Calcular total e registrar inscrição com pagamento pendente.
3. Gerar PDF com identificação, dados, categorias e total.
4. Enviar PDF como anexo à organização por SMTP configurável.
5. Informar confirmação da inscrição e resultado real do envio.

O destinatário da organização e as credenciais SMTP ficam em variáveis de
ambiente do servidor. O endereço informado pelo atleta não define o
destinatário dessa mensagem. O PDF não será comprovante de pagamento.

Se SMTP falhar, preservar a inscrição, registrar falha de envio e apresentar
erro explícito com possibilidade de repetir o envio, sem duplicar a
inscrição. Retries usam identificador/token de operação não previsível;
não expor dados pessoais por identificadores públicos. Não marcar envio
como concluído antes de o SMTP aceitar a mensagem. Aceitação SMTP não
garante entrega na caixa de entrada.

Não adicionar painel administrativo, verificação manual ou webhook bancário
neste escopo.

## Configuração e proteção

Configuração necessária: banco, SMTP, remetente, destinatário da organização,
chave Pix, nome e cidade do recebedor. Documentar variáveis em exemplo
sem credenciais e instruções de inicialização no README.

Variáveis obrigatórias ausentes geram erros explícitos, não sucesso simulado.
Não registrar conteúdo integral do formulário, credenciais ou PDFs em logs.
Limitar o tamanho das requisições, validar categorias contra a lista fixa e
proteger o envio contra submissões repetidas/abuso.

Após revisão técnica, apenas o protocolo opaco da operação será mantido em
sessionStorage para proteger retries ao recarregar a mesma aba. Não persistir
dados pessoais. O atleta precisa preencher os mesmos dados novamente; uma
operação nova é iniciada explicitamente pelo botão após confirmação de envio.

## Layout da prévia

Header com a imagem fornecida, introdução breve e formulário dividido em
dados do atleta, participação em 2026 e categorias. Em desktop, resumo
de pagamento ao lado; em celular, abaixo das categorias. Labels visíveis,
estados de foco, erros associados aos campos e controles acessíveis.

## Verificação

- Type-check, lint e build com as ferramentas existentes.
- Testes do preço para zero, uma, duas e todas as oito categorias.
- Testes dos oito valores, campos Pix, CRC e atualização do copia e cola.
- Validação de datas, e-mail, campos obrigatórios, categorias desconhecidas
  e duplicadas.
- Testes de persistência e idempotência em banco de teste.
- PDF válido e envio SMTP com anexo, incluindo falha e retry.
- Inscrição preservada quando o e-mail falha.
- Verificação no navegador em desktop/celular, navegação por teclado e
  imagem respondendo HTTP 200.

Integrações reais só serão declaradas verificadas após configurar banco
e SMTP válidos; nenhuma credencial será solicitada na conversa.
