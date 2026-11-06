# Parceiro por categoria

## Escopo aprovado

Ao marcar uma categoria, exibir um input com o rótulo “Nome do parceiro
(opcional)” na mesma linha, à direita do nome da categoria. Em telas estreitas,
permitir quebra de linha para preservar a largura útil do input.

Cada categoria selecionada pode ter um parceiro diferente. O atleta informa
um nome, não um identificador de cadastro. O armazenamento usará
`PairOfPlayers.player1Id`, conforme solicitado, apesar do sufixo `Id`.

## Formulário e validação

- Exibir o campo somente enquanto a categoria estiver selecionada.
- Campo opcional; quando preenchido, exigir nome e sobrenome, de 3 a 150
  caracteres após remover espaços externos, sem caracteres de controle.
  Compartilhar a validação entre cliente e servidor.
- Usar rótulo acessível e identificador exclusivo por categoria.
- Desmarcar uma categoria remove também o nome associado; marcar novamente
  apresenta um campo vazio.
- Não mudar preços, horários, categorias ou a geração do Pix.
- Bloquear o input junto aos demais dados durante o envio e os retries.
- Limpar todos os nomes ao iniciar o cadastro de outro atleta.

O payload terá uma coleção de parceiros associada a IDs de categorias válidas.
Ausência da coleção será aceita para preservar clientes anteriores. Nomes
somente podem se referir a categorias selecionadas; categorias duplicadas e
desconhecidas serão rejeitadas.

## Persistência

Adicionar uma relação de inscrição para múltiplos registros de `PairOfPlayers`.
Cada novo registro associa inscrição, categoria e nome do parceiro.
Aplicar unicidade para o par inscrição/categoria.
Não criar registros de parceiro para campos vazios.

Preservar a relação legada `Registration.pairOfPlayersId` e todos os registros
existentes. As novas colunas de associação em `PairOfPlayers` serão nullable
para compatibilidade com dados legados. Usar TEXT nos dois lados das chaves
estrangeiras. Criar uma nova migração, sem modificar migrações aplicadas ou
executar reset de banco.

Criar inscrição e parceiros de forma atômica. Reenvios e requisições concorrentes
não podem criar registros duplicados. A comparação de conteúdo da operação
considera parceiros em ordem determinística e mantém compatibilidade com
protocolos anteriores quando nenhum parceiro é informado.

## PDF e erros

O PDF mostrará o nome do parceiro junto à categoria correspondente ou
“Não informado” quando vazio. Os nomes não serão persistidos no navegador nem
incluídos em logs.

Erros de validação serão associados aos campos e erros de comunicação manterão
os dados para retry, seguindo o fluxo atual.

## Verificação

- Selecionar duas categorias e preencher parceiros diferentes.
- Desmarcar e remarcar uma categoria sem afetar a outra.
- Enviar com nomes preenchidos e com todos os nomes vazios.
- Validar tamanho, caracteres de controle e associação às categorias.
- Persistência atômica, unicidade e retry sem duplicação.
- PDF com o parceiro correto em cada categoria.
- Navegação por teclado e layout em desktop e celular.
- Prisma validate/generate, typecheck, lint dos arquivos afetados e testes.

Integrações com banco e SMTP somente serão declaradas verificadas quando
executadas em ambiente de teste isolado.
