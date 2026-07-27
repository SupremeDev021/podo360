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
