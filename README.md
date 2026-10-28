# TechStore Secrets Lab

Laboratório prático de **Gerenciamento de Segredos em DevOps**.

Este projeto simula uma aplicação simplificada da TechStore, contendo uma API, configurações de banco de dados, rotina de backup e ambiente Docker.

O projeto foi desenvolvido propositalmente com diferentes problemas relacionados ao gerenciamento de informações sensíveis.

> **Status:** versão corrigida (tag `v1.0.0`). Os 10 problemas identificados estão corrigidos e documentados no [`SECURITY.md`](SECURITY.md). A versão original, com os problemas, está preservada na tag `v0.1.0`. O resumo da solução está na seção [✅ Solução](#-solução).

---

## 🎯 Objetivo

O objetivo desta atividade é analisar um projeto existente, identificar problemas relacionados ao gerenciamento de segredos e aplicar correções utilizando boas práticas de segurança.

Durante a atividade, você deverá analisar o código-fonte, arquivos de configuração e arquivos relacionados à infraestrutura.

A proposta não é apenas encontrar problemas, mas compreender:

- onde um segredo pode ser exposto;
- como ele pode ser armazenado de forma inadequada;
- como pode ser acessado indevidamente;
- como pode ser exposto durante a execução;
- como evitar que informações sensíveis sejam versionadas;
- como aplicar o princípio do menor privilégio;
- como separar configuração de código;
- como reduzir a superfície de exposição de credenciais.

---

## 🧩 Contexto

A **TechStore** é uma aplicação fictícia de comércio eletrônico.

O projeto possui componentes que representam situações comuns encontradas em aplicações modernas:

- aplicação Node.js;
- configurações de banco de dados;
- credenciais de serviços externos;
- tokens de comunicação interna;
- arquivos de configuração;
- variáveis de ambiente;
- rotina de backup;
- ambiente Docker Compose.

A aplicação é propositalmente simples para que o foco da atividade esteja na **análise de segurança e no gerenciamento de segredos**.

---

## 🛠️ Tecnologias utilizadas

- Node.js
- Express
- npm
- dotenv
- Docker
- Docker Compose
- MySQL
- gitleaks (varredura de segredos)
- GitHub Actions (integração contínua)

---

## 📁 Estrutura do projeto

    techstore-secrets-lab/
    │
    ├── .github/
    │   ├── workflows/
    │   │   ├── secret-scan.yml        # varredura de segredos (gitleaks) em todo PR
    │   │   └── compose-smoke.yml      # sobe o ambiente Docker e testa as proteções
    │   ├── dependabot.yml
    │   └── pull_request_template.md
    │
    ├── src/
    │   ├── app.js
    │   ├── config.js                  # leitura de configuração e segredos (readSecret)
    │   └── database.js
    │
    ├── scripts/
    │   ├── backup.js
    │   ├── generate-secrets.sh        # gera os secrets do Docker Compose
    │   └── rotate-db-password.sh      # rotaciona senhas do banco sem perda de dados
    │
    ├── .dockerignore
    ├── .env.example                   # modelo de configuração, sem valores sensíveis
    ├── .gitattributes
    ├── .gitignore
    ├── .gitleaks.toml                 # regra própria para segredos de baixa entropia
    ├── .nvmrc
    ├── docker-compose.yml
    ├── Dockerfile
    ├── package.json
    ├── package-lock.json
    ├── README.md
    └── SECURITY.md                    # relatório de análise de segurança

Os arquivos `.env` e `secrets/` são criados localmente na configuração inicial e **nunca são versionados**.

---

# 🚀 Execução do projeto

## 1. Pré-requisitos

Antes de iniciar, certifique-se de possuir:

- Node.js 18 ou superior;
- npm instalado;
- Docker instalado;
- Docker Compose disponível;
- OpenSSL (já incluído no Git Bash, no Windows);
- gitleaks (opcional, para o hook de pre-commit).

Verifique:

    node --version
    npm --version
    docker --version
    docker compose version
    openssl version

No Windows, execute os comandos no **Git Bash**.

---

## 2. Configuração inicial

Execute estes passos **uma única vez**, logo após clonar o repositório.

**Variáveis de ambiente para execução local:**

    cp .env.example .env

Abra o `.env` e preencha os valores vazios (`DB_PASSWORD`, `PAYMENT_API_KEY`, `INTERNAL_API_TOKEN` e `BACKUP_API_KEY`). Para gerar valores aleatórios:

    openssl rand -hex 32

**Secrets para o Docker Compose:**

    bash scripts/generate-secrets.sh

O script cria o diretório `secrets/` com valores aleatórios. Nenhum valor é exibido no terminal.

**Hook de pre-commit (recomendado):**

    printf '#!/bin/sh\ngitleaks git --pre-commit --staged --redact -v\n' > .git/hooks/pre-commit
    chmod +x .git/hooks/pre-commit

O hook impede commits que contenham segredos. Hooks ficam em `.git/hooks` e não são versionados, por isso cada pessoa precisa instalá-lo na própria máquina.

---

## 3. Instalar as dependências

Na raiz do projeto:

    npm ci

O `npm ci` instala exatamente as versões registradas no `package-lock.json`.

---

## 4. Executar a aplicação

Execute:

    npm start

A aplicação deverá iniciar na porta:

    3000

Se alguma variável obrigatória estiver ausente no `.env`, a aplicação não inicia e informa quais variáveis estão faltando.

---

## 5. Testar a aplicação

### Página principal

    http://localhost:3000/

### Health Check

    http://localhost:3000/health

Retorna apenas o status da aplicação.

### Configuração

    http://localhost:3000/config-check

Endpoint de diagnóstico protegido. Sem autenticação, responde `401`. Para acessá-lo, envie o token interno:

    curl -H "Authorization: Bearer $(grep '^INTERNAL_API_TOKEN=' .env | cut -d= -f2-)" http://localhost:3000/config-check

### Backup

    npm run backup

---

# 🐳 Execução com Docker Compose

Com os secrets gerados na configuração inicial, construa a imagem e suba os serviços, aguardando os *healthchecks*:

    docker compose up -d --build --wait

Verifique os serviços:

    docker compose ps

Para visualizar os logs:

    docker compose logs

Para interromper os serviços:

    docker compose down

Para interromper e **apagar os dados do banco**:

    docker compose down -v

Para acessar o banco (a porta não é publicada no host):

    docker compose exec database mysql -u techstore_app -p techstore

Para rotacionar as senhas do banco sem perder dados:

    bash scripts/rotate-db-password.sh app
    bash scripts/rotate-db-password.sh root

---

# 🔎 Desafio

Você recebeu este projeto como parte de uma revisão de segurança.

A aplicação funciona, porém existem **problemas propositalmente inseridos relacionados ao gerenciamento de segredos**.

Sua missão é realizar uma análise do projeto e identificar esses problemas.

### Você deverá:

1. analisar todos os arquivos;
2. identificar informações sensíveis;
3. identificar formas inadequadas de armazenamento;
4. identificar possíveis exposições;
5. verificar configurações de acesso;
6. corrigir os problemas encontrados;
7. aplicar boas práticas de gerenciamento de segredos;
8. documentar as alterações realizadas.

---

# 📋 Entregáveis

Ao finalizar a atividade, seu repositório deverá conter:

## 1. Projeto corrigido

O código deverá estar funcionando após as alterações.

---

## 2. README atualizado

Além deste README, documente:

- problemas encontrados;
- correções realizadas;
- boas práticas utilizadas;
- decisões técnicas;
- estratégia utilizada para gerenciamento das informações sensíveis.

---

## 3. Relatório de análise

Crie um arquivo:

    SECURITY.md

Nele, registre cada problema identificado.

Utilize o seguinte modelo:

    ## Problema 1

    ### Local

    Arquivo ou componente onde o problema foi encontrado.

    ### Problema identificado

    Descrição do problema.

    ### Risco

    Explique qual poderia ser o impacto de segurança.

    ### Correção aplicada

    Explique como o problema foi corrigido.

    ### Justificativa

    Explique por que a solução adotada é mais segura.

Repita o modelo para todos os problemas encontrados.

---

# ✅ Solução

O detalhamento de cada problema, com local, risco, correção e justificativa, está no [`SECURITY.md`](SECURITY.md). Esta seção resume o trabalho.

## Problemas encontrados e correções realizadas

| # | Local | Problema | Correção | Issue |
|---|---|---|---|---|
| 1 | `.env` | Arquivo de segredos versionado em repositório público | Removido do Git; `.env.example` sem valores sensíveis | #3 |
| 2 | `.gitignore` | Não protegia arquivos sensíveis | Cobertura de ambiente, credenciais, chaves e backups; regra própria do gitleaks | #4 |
| 3 | `config/credentials.json` | Credenciais em texto puro, incluindo chave de produção | Arquivo removido; configuração apenas pelo ambiente | #5 |
| 4 | `src/config.js` | Credenciais do banco fixas no código | Leitura do ambiente com validação na inicialização | #6 |
| 5 | `src/database.js` | Conexão como `root` e usuário exibido em log | Usuário de menor privilégio; log sem dados de conexão | #7 |
| 6 | `src/app.js` | Endpoints expunham infraestrutura e estado dos segredos | `/health` mínimo; `/config-check` protegido por token | #8 |
| 7 | `scripts/backup.js` | Chave de API impressa no log | Credencial nunca exibida; variável ausente interrompe a execução | #9 |
| 8 | `docker-compose.yml` | Senhas em texto puro, senha root compartilhada e duplicada | Docker secrets (`_FILE`), senhas distintas e aleatórias | #10 |
| 9 | `docker-compose.yml` | Porta do MySQL publicada no host | Porta removida; banco em rede interna | #11 |
| 10 | `docker-compose.yml` | Projeto inteiro montado no container, em modo de desenvolvimento | Imagem própria, usuário não-root, sistema de arquivos somente leitura | #12 |

Os segredos que estiveram no histórico do Git foram tratados como comprometidos, com plano de revogação e rotação (issue #13).

## Boas práticas aplicadas

- **Separação entre configuração e código:** nenhum segredo no código-fonte; toda configuração vem do ambiente.
- **Princípio do menor privilégio:** usuário de banco restrito ao banco da aplicação; container sem `root`, sem *capabilities* e somente leitura; container da aplicação sem acesso à senha root.
- **Redução da superfície de exposição:** banco sem porta publicada e em rede interna; endpoints sem informações de infraestrutura; imagem com apenas o necessário.
- **Segredos fora dos logs:** nenhum valor sensível é impresso, nem parcialmente.
- **Segredos fortes:** todos os valores gerados aleatoriamente com `openssl`, substituindo as senhas fracas originais.
- **Defesa em camadas:** `.gitignore`, hook de pre-commit, gitleaks no CI, *push protection* do GitHub e regras de proteção da branch principal.
- **Falha explícita:** configuração ausente impede a inicialização, em vez de causar erros silenciosos.
- **Reprodutibilidade:** `package-lock.json`, `npm ci` e versão do Node fixada em `.nvmrc`.

## Decisões técnicas

**Não reescrever o histórico do Git.** Um segredo publicado em repositório público pode já ter sido copiado; apagá-lo do histórico não desfaz a exposição. A reescrita também romperia o vínculo deste fork com o repositório original. A resposta adotada foi tratar todos os segredos como comprometidos e rotacioná-los.

**Docker secrets com a convenção `_FILE`.** Variáveis de ambiente aparecem no `docker inspect` e são herdadas por processos filhos. Os segredos passaram a ser arquivos montados apenas nos containers que precisam deles. A função `readSecret` lê o arquivo indicado em `<NOME>_FILE` e, na execução local, recorre ao `.env`, de modo que o mesmo código funciona nos dois cenários. É a mesma convenção usada por Docker Swarm e Kubernetes.

**Proteger o `/config-check` em vez de removê-lo.** O diagnóstico continua útil para operadores autorizados. O token é comparado em tempo constante para impedir ataques de temporização, e o endpoint responde `404` quando não há token configurado, sem anunciar sua existência.

**Regra própria no gitleaks.** As regras padrão detectavam apenas 1 dos 11 segredos do projeto, porque senhas escolhidas por pessoas têm baixa entropia. A regra `assigned-secret` passou a detectar todos. Ao longo do projeto, a regra foi calibrada para não acusar referências que não são valores (`process.env`, `/run/secrets/`, chamadas de função e `$(...)`), sempre verificando que os 11 segredos originais continuavam detectados.

**Testes de regressão de segurança no CI.** O pipeline sobe o ambiente Docker com secrets gerados na hora e falha o pull request se alguma exposição corrigida voltar: segredo em variável de ambiente, porta do banco publicada, processo como `root`, `.env` ou `.git` no container, endpoint sem autenticação, entre outras verificações.

**Regras de proteção sem exceção para administradores.** A primeira configuração permitia que administradores fizessem merge sem os checks obrigatórios, o que anulava a proteção silenciosamente. A exceção foi removida: nenhum código entra na `main` sem as verificações de segurança aprovadas, inclusive o da própria mantenedora.

**Baseline funcional separada das correções de segurança.** A versão original não executava. Os reparos funcionais foram feitos em commits próprios (`fix(app)`), antes das correções de segurança (`fix(security)`), para que cada um dos 10 problemas tivesse uma correção isolada e rastreável.

**Problemas encontrados durante os testes.** Dois defeitos só apareceram na prática e foram corrigidos:

- no Windows, o `openssl` termina a saída com CRLF, e o caractere CR gerava senhas divergentes entre a aplicação e o MySQL;
- remover o `.env` do Git faz com que o arquivo seja apagado das máquinas que executam `git pull`, o que motivou a seção de configuração inicial deste README.

## Estratégia de gerenciamento de segredos

| Ambiente | Onde ficam os segredos | Características |
|---|---|---|
| Desenvolvimento | `.env` e `secrets/`, locais e ignorados pelo Git | Valores aleatórios, exclusivos de cada máquina |
| CI | Gerados a cada execução do pipeline | Descartados ao final; nunca reutilizados |
| Produção | Gerenciador de segredos (GitHub Environments, configurado neste repositório, ou serviços como AWS Secrets Manager, Azure Key Vault e HashiCorp Vault) | Acesso restrito, auditoria e rotação periódica |

**Ciclo de vida:** os segredos são gerados aleatoriamente, entregues apenas a quem precisa deles, nunca exibidos em logs ou respostas, e rotacionados a cada 90 dias ou imediatamente em caso de suspeita de vazamento. As senhas do banco são rotacionadas pelo `scripts/rotate-db-password.sh`, sem perda de dados. O plano de resposta para os segredos que estiveram no histórico, a política de rotação e as camadas de prevenção estão detalhados no `SECURITY.md`.

## Resultado da validação

Validação executada em um clone limpo do repositório, simulando o primeiro uso por uma nova pessoa.

| Critério | Versão original (`v0.1.0`) | Versão corrigida |
|---|---|---|
| Segredos versionados | `.env`, `credentials.json`, `config.js`, `docker-compose.yml` | Nenhum |
| Detecção pelo gitleaks | 1 de 11 segredos | 11 de 11, com regra própria |
| Aplicação local | Não executava | Executa; `npm ci` sem vulnerabilidades |
| `/health` | Expunha o host do banco | Retorna apenas o status |
| `/config-check` | Público, com nome do banco | `401` sem token |
| Log do backup | Imprimia a chave de API | Não exibe a credencial |
| Log de conexão | Exibia conexão como `root` | Sem dados de conexão |
| Porta do MySQL | Publicada em `0.0.0.0:3306` | Apenas na rede interna |
| Usuário do container | `root` | `node` (uid 1000) |
| Conteúdo do container | `.env`, `.git` e credenciais, com escrita liberada | Apenas o necessário, somente leitura |
| Variáveis do container | Senhas em texto puro | Apenas referências `_FILE` |

## Organização do trabalho

- **Issues:** uma por problema, agrupadas no milestone "Entrega".
- **Branches e pull requests:** uma branch por etapa, com merge por *squash* e commits no padrão Conventional Commits.
- **Proteção da `main`:** merge somente por pull request, com os checks `gitleaks` e `compose` aprovados, histórico linear e sem *force push*.
- **Tags:** `v0.1.0` (versão original) e `v1.0.0` (versão corrigida), protegidas contra alteração e exclusão.

---

# 🧪 Validação

Depois das correções:

1. instale novamente as dependências;
2. execute a aplicação;
3. execute os endpoints disponíveis;
4. execute o Docker Compose;
5. verifique os logs;
6. confirme que a aplicação continua funcionando;
7. verifique se informações sensíveis não estão mais sendo expostas.

Uma correção de segurança não deve simplesmente fazer a aplicação parar de funcionar.

---

# 📌 Git

Antes de finalizar, verifique o histórico e os arquivos que serão enviados para o repositório.

Execute:

    git status

Depois:

    git diff

Verifique cuidadosamente se nenhuma informação sensível está sendo preparada para commit.

---

# 📝 Checklist final

Antes de entregar, confirme:

- [x] Analisei todos os arquivos do projeto.
- [x] Identifiquei os problemas de segurança.
- [x] Corrigi os problemas encontrados.
- [x] A aplicação continua funcionando.
- [x] Testei os endpoints.
- [x] Testei o Docker Compose.
- [x] Revisei os logs.
- [x] Revisei o `git status`.
- [x] Revisei o `git diff`.
- [x] Não estou versionando informações sensíveis.
- [x] Criei o `SECURITY.md`.
- [x] Documentei as decisões tomadas.
- [x] Expliquei como as credenciais devem ser gerenciadas.
- [x] Considerei rotação e revogação de credenciais.

---

# 🎓 Critério principal da atividade

A atividade não será avaliada apenas pela remoção de informações sensíveis.

Você deverá demonstrar que compreendeu:

> **Onde um segredo pode aparecer, por que isso representa um risco e como gerenciá-lo de forma segura durante seu ciclo de vida.**

Uma solução será considerada adequada quando, além de corrigir o problema, apresentar uma justificativa técnica coerente.

---

# ⚠️ Importante

Este projeto é **exclusivamente educacional**.

Todas as credenciais, tokens, chaves e informações sensíveis presentes no projeto são fictícias e não devem ser utilizadas em ambientes reais.

Nunca utilize credenciais reais durante a realização desta atividade.

---

# 👨‍🏫 Orientação da atividade

O repositório foi preparado propositalmente com problemas de segurança para que a análise seja realizada pelos alunos.

O README orienta a investigação **sem revelar previamente quais são os problemas existentes**.

A avaliação será baseada na capacidade de:

- identificar os problemas;
- compreender os riscos;
- aplicar as correções;
- validar o funcionamento da aplicação;
- justificar tecnicamente as decisões tomadas;
- documentar as alterações realizadas.

A atividade possui **10 problemas principais**, permitindo uma avaliação objetiva de:

**10 problemas identificados e corrigidos = 10 pontos.**

O arquivo `SECURITY.md` deverá ser utilizado para verificar não apenas se o aluno encontrou os problemas, mas também se compreendeu **por que cada correção foi necessária e qual risco estava sendo tratado**.

---

# 📚 Resultado esperado

Ao final da atividade, o repositório deverá representar uma versão mais segura da aplicação, com:

- menor exposição de credenciais;
- melhor separação entre código e configuração;
- aplicação do princípio do menor privilégio;
- proteção adequada de arquivos sensíveis;
- redução de informações confidenciais em logs;
- melhores práticas para utilização de Docker e Docker Compose;
- documentação das decisões de segurança;
- consideração sobre rotação e revogação de credenciais.

O objetivo final é compreender que **gerenciar segredos não significa apenas esconder uma senha**, mas controlar todo o ciclo de vida das informações sensíveis dentro do ambiente DevOps.

## Autor

Jorge Mesquita · [github.com/usuario-do-jorge](https://github.com/Rxmainless) · jjorgefilho@outlook.com