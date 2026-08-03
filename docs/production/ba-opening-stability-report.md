# Relatorio de Estabilidade da Abertura de BA

Data: 27/07/2026

## Resultado

A abertura de BA foi corrigida e validada com interface real, sessao autenticada e banco oficial.

## Causas encontradas

1. A tela ficava utilizavel depois do refresh antes de possuir o paciente no estado em memoria. Ao tentar abrir novamente, o frontend tentava inserir o paciente ja existente e mostrava uma falha generica.
2. A criacao do BA fazia uma consulta e um insert separados, sem constraint que impedisse dois BAs abertos em requisicoes concorrentes.
3. Uma oscilacao podia ocorrer depois do commit e antes da resposta chegar ao navegador. O BA ficava salvo, mas o frontend nao reconciliava o resultado.
4. Sessao, permissao, conexao, constraint e erro inesperado eram apresentados com a mesma mensagem.

## Correcoes

- A identidade do paciente e confirmada diretamente no banco antes de criar um novo cadastro.
- O envio possui trava sincrona alem do estado visual de loading.
- O banco possui indice unico parcial por `company_id` e `patient_id` para status abertos.
- Falhas transitorias recebem uma tentativa controlada e reconciliacao no banco antes de informar falha.
- O sucesso so e exibido depois de receber ou recuperar o registro confirmado no banco.
- Mensagens distintas foram adicionadas para sessao expirada, permissao, conexao e erro inesperado.

## Validacao

- Lint: aprovado.
- Typecheck: aprovado.
- Build de producao: aprovado.
- Playwright autenticado: aprovado.
- Playwright repetido no dominio publico: aprovado.
- Primeiro BA criado e confirmado depois de refresh.
- Duplo envio nao criou segundo BA.
- Nova tentativa para o mesmo paciente exibiu bloqueio de BA aberto.
- Nao havia BAs abertos duplicados antes da migration.

## Dados de teste

Foram criados os BAs `BA-2026-000063`, `BA-2026-000064` e `BA-2026-000065` durante diagnostico, repeticao local e validacao no dominio publico.
Os pacientes, atendimentos e PUs correspondentes foram removidos por IDs especificos.
A consulta final encontrou zero pacientes e zero PUs do prefixo `TESTE_PRODUCAO_BA_INSTABILIDADE_`.

## Revalidacao de resiliencia - 02/08/2026

O fluxo recebeu uma segunda camada de protecao para os casos em que a conexao cai durante a criacao do paciente ou do BA:

- paciente e atendimento recebem UUID v4 antes do primeiro envio;
- uma nova tentativa reutiliza exatamente o mesmo UUID;
- antes de repetir, o frontend consulta o registro pelo UUID e recupera uma gravacao cujo retorno tenha sido perdido;
- a constraint parcial continua sendo a defesa definitiva contra dois BAs abertos para o mesmo paciente e empresa;
- o formulario preserva os dados quando o navegador esta offline e o botao nao permite envio;
- falhas de sessao, permissao, rede, duplicidade e erro inesperado possuem mensagens distintas.

O Playwright autenticado interrompeu deliberadamente o primeiro `POST` de paciente e o primeiro `POST` de atendimento. As duas operacoes foram recuperadas com o mesmo UUID, sem duplicidade. O teste gerou `BA-2026-000067` e `PU-2026-000078`, confirmou persistencia apos recarregar e bloqueou um segundo BA. Paciente, atendimento, dados clinicos, vinculo e PU foram removidos depois por IDs exatos.

Validacoes desta rodada: lint, typecheck, build e E2E autenticado aprovados; `npm audit` sem vulnerabilidades. A publicacao desta segunda camada no Nginx ainda depende de restabelecer a autenticacao SSH do servidor.

## Deploy e teste publico - 02/08/2026

- A autenticacao SSH foi restabelecida com chave Ed25519 dedicada.
- O build foi publicado em `/home/supremetech/podo360-sites/clinic`, volume somente leitura do container `podo360-clinic-web`.
- Backup anterior: `/home/supremetech/podo360-sites/clinic.backup.20260802-211030`.
- Asset publicado: `assets/index-DHHSMA6-.js`.
- O primeiro envio por `scp` preservou diretorios como `700`; a checagem interna detectou HTTP 403 imediatamente. As permissoes foram ajustadas para diretorios `755` e arquivos `644` antes da validacao publica.
- O E2E autenticado foi repetido em `https://podo360.supremetechdev.com` com falha de rede simulada e passou.
- Foram gerados `BA-2026-000068` e `PU-2026-000079`; paciente, dados clinicos, vinculo, atendimento e PU foram removidos por IDs exatos.
- A verificacao final retornou zero dados com o prefixo de teste e zero grupos de BA aberto duplicado.
