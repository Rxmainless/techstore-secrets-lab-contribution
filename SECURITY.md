# Relatório de Análise de Segurança – TechStore Secrets Lab

Este documento registra os problemas de gerenciamento de segredos identificados no projeto, os riscos associados e as correções aplicadas.

> **Baseline analisada:** commit `8192ae3` (tag `v0.1.0`).
> Os valores dos segredos foram omitidos intencionalmente deste relatório. Registrar um segredo na documentação seria criar mais um ponto de exposição.

---

## Metodologia

A análise combinou duas abordagens:

1. **Varredura automatizada** com [gitleaks](https://github.com/gitleaks/gitleaks), aplicada ao histórico completo do Git (`gitleaks git`) e aos arquivos do diretório de trabalho (`gitleaks dir`), com a opção `--redact` para não exibir valores na saída.
2. **Revisão manual** de todos os arquivos: código-fonte, configuração, scripts e infraestrutura.

### Resultado da varredura automatizada

O gitleaks identificou **apenas 1 segredo**: a chave de API de pagamento em `config/credentials.json`, pela regra `generic-api-key`.

Todos os demais segredos passaram despercebidos. As regras do scanner se baseiam em formatos conhecidos de provedores e em **entropia** (o grau de aleatoriedade da string). Senhas escolhidas por pessoas, como palavras seguidas de números, têm entropia baixa e não são detectadas.

Dessa constatação decorrem duas conclusões:

- **Scanners são uma camada de defesa, não a defesa completa.** A revisão humana continua necessária, e as regras do scanner precisam ser ajustadas ao projeto.
- **As senhas do projeto são fracas.** A mesma característica que as torna invisíveis ao scanner as torna vulneráveis a ataques de dicionário.

---

## Inventário de segredos

| Segredo | Onde aparece | Valores distintos | Detectado pelo gitleaks |
|---|---|---|---|
| Senha do banco (usuário da aplicação) | `.env`, `src/config.js`, `config/credentials.json`, `docker-compose.yml` | 4 | Não |
| Senha root do MySQL | `docker-compose.yml` (chave duplicada) | 2 | Não |
| Chave de API de pagamento | `.env`, `config/credentials.json` | 2 | Somente em `credentials.json` |
| Token da API interna | `.env`, `config/credentials.json` | 2 | Não |

O projeto também usa **quatro identidades diferentes** para acessar o mesmo banco (`techstore_app`, `techstore_root`, `root` e `adminTechstore`). Não existe uma fonte única de configuração: a mesma credencial tem valores divergentes conforme o arquivo, o que torna impossível rotacioná-la com segurança.

### Exposições não detectáveis por scanner

| Exposição | Local |
|---|---|
| Host do banco devolvido em resposta HTTP | `src/app.js` (`/health`) |
| Estado de configuração dos segredos revelado | `src/app.js` (`/config-check`) |
| Segredo impresso em log | `scripts/backup.js` |
| Usuário do banco impresso em log | `src/database.js` |
| Conexão com privilégio máximo | `src/database.js` |
| Banco de dados acessível de fora do host | `docker-compose.yml` |
| Arquivos sensíveis montados no container | `docker-compose.yml` |

---

## Problema 1

### Local

`.env`

### Problema identificado

O arquivo de variáveis de ambiente contém os valores reais da senha do banco, da chave de API de pagamento e do token da API interna, e está rastreado pelo Git e publicado em um repositório público.

### Risco

Qualquer pessoa com acesso ao repositório, ou a qualquer clone ou fork dele, obtém todas as credenciais da aplicação. O arquivo `.env` existe justamente para separar configuração de código; versioná-lo anula esse propósito. Além disso, o segredo permanece no histórico do Git mesmo depois que o arquivo é removido.

### Correção aplicada

_Pendente – Etapa 3 (issue #3)._

### Justificativa

_Pendente._

---

## Problema 2

### Local

`.gitignore`

### Problema identificado

O `.gitignore` cobre apenas `node_modules/`, `logs/` e `dist/`. Não há proteção para arquivos de ambiente (`.env`), arquivos de credenciais, chaves privadas (`*.pem`, `*.key`) nem arquivos de backup.

### Risco

Sem essa barreira preventiva, um simples `git add .` publica qualquer arquivo sensível presente no diretório. Esta é a causa raiz dos problemas 1 e 3.

### Correção aplicada

_Pendente – Etapa 3 (issue #4)._

### Justificativa

_Pendente._

---

## Problema 3

### Local

`config/credentials.json`

### Problema identificado

Arquivo dedicado a credenciais, em texto puro e versionado, contendo usuário e senha administrativos do banco, a chave de API de pagamento com prefixo de produção (`live`) e o token da API interna.

### Risco

O arquivo concentra vários segredos em um único ponto de vazamento. O prefixo `live` indica uma chave de produção, capaz de gerar transações e cobranças reais. Como os valores divergem dos definidos no `.env`, não existe fonte única de verdade, e a rotação das credenciais fica sujeita a erro.

### Correção aplicada

_Pendente – Etapa 3 (issue #5)._

### Justificativa

_Pendente._

---

## Problema 4

### Local

`src/config.js`

### Problema identificado

A função `getDatabaseConfig()` retorna host, usuário e senha do banco como valores literais no código, ignorando as variáveis de ambiente. O usuário configurado tem nome que indica privilégio administrativo.

### Risco

O segredo fica acoplado ao código-fonte: qualquer pessoa com acesso ao código tem acesso ao banco. Trocar a senha exige alterar o código e fazer um novo deploy, e o mesmo valor acaba sendo usado em todos os ambientes (desenvolvimento, homologação e produção).

### Correção aplicada

_Pendente – Etapa 4 (issue #6)._

### Justificativa

_Pendente._

---

## Problema 5

### Local

`src/database.js`

### Problema identificado

O objeto de conexão define o usuário `root` de forma fixa, sobrescrevendo o usuário configurado. Além disso, a função `connect()` imprime no log o nome do banco e o usuário da conexão.

### Risco

Viola o princípio do menor privilégio. Se a aplicação for comprometida, por exemplo via SQL injection, o atacante obtém controle total do servidor de banco: pode apagar dados, criar usuários e ler todos os bancos da instância. O log ainda revela qual identidade atacar.

### Correção aplicada

_Pendente – Etapa 4 (issue #7)._

### Justificativa

_Pendente._

---

## Problema 6

### Local

`src/app.js` – endpoints `/health` e `/config-check`

### Problema identificado

O `/health` devolve o host do banco de dados. O `/config-check` devolve o nome do banco e indica quais segredos estão configurados. Nenhum dos dois exige autenticação.

### Risco

Exposição de informação (*information disclosure*). Um atacante usa esses endpoints para reconhecimento: mapeia a infraestrutura interna e descobre quais integrações existem antes de atacar. Endpoints públicos de diagnóstico são alvo comum de enumeração automatizada.

### Correção aplicada

_Pendente – Etapa 4 (issue #8)._

### Justificativa

_Pendente._

---

## Problema 7

### Local

`scripts/backup.js`

### Problema identificado

A rotina de backup imprime a chave de API no console. O script também lê a variável `API_KEY`, que não está definida em nenhuma configuração do projeto.

### Risco

Logs são copiados para arquivos, agregadores (ELK, CloudWatch), pipelines de CI e tickets de suporte, quase sempre com retenção longa e controle de acesso mais fraco que o de um cofre de segredos. Um segredo impresso em log se multiplica fora de qualquer controle.

### Correção aplicada

_Pendente – Etapa 4 (issue #9)._

### Justificativa

_Pendente._

---

## Problema 8

### Local

`docker-compose.yml` – variáveis de ambiente dos serviços

### Problema identificado

As senhas do usuário da aplicação e do root do MySQL estão em texto puro no arquivo versionado. Em uma das definições, a mesma senha é usada para o root e para o usuário da aplicação. A chave `MYSQL_ROOT_PASSWORD` aparece duplicada, com valores diferentes.

### Risco

O arquivo de infraestrutura publica as credenciais do banco. A senha compartilhada entre root e aplicação elimina a separação de papéis: vazar uma é vazar as duas. A chave duplicada torna ambíguo qual valor é aplicado, o que gera configuração imprevisível. Variáveis de ambiente também ficam visíveis a qualquer pessoa com acesso a `docker inspect`.

### Correção aplicada

_Pendente – Etapa 5 (issue #10)._

### Justificativa

_Pendente._

---

## Problema 9

### Local

`docker-compose.yml` – serviço do banco de dados

### Problema identificado

O mapeamento `3306:3306` publica a porta do MySQL em todas as interfaces de rede do host.

### Risco

O banco fica acessível a partir da rede, e não apenas da aplicação. Combinado com senhas fracas e já publicadas, isso permite acesso direto ao banco sem passar pela aplicação. A aplicação só precisa da rede interna do Docker Compose para se conectar.

### Correção aplicada

_Pendente – Etapa 5 (issue #11)._

### Justificativa

_Pendente._

---

## Problema 10

### Local

`docker-compose.yml` – volumes e ambiente do serviço da aplicação

### Problema identificado

O volume `.:/app` monta o diretório inteiro do projeto dentro do container, incluindo `.env`, `config/credentials.json` e o diretório `.git`. O serviço também roda com `NODE_ENV=development`.

### Risco

Segredos e histórico do Git passam a existir dentro do container. Se o container for comprometido, tudo fica exposto, e o acesso de escrita do volume permite alterar arquivos do host. O modo de desenvolvimento costuma expor mensagens de erro e stack traces detalhados.

### Correção aplicada

_Pendente – Etapa 5 (issue #12)._

### Justificativa

_Pendente._

---

## Segredos no histórico do Git

_Pendente – Etapa 6 (issue #13): plano de rotação e revogação de cada credencial._
