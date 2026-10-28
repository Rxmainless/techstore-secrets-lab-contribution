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

O arquivo `.env` foi removido do rastreamento do Git com `git rm --cached`, permanecendo apenas no ambiente local. Foi criado o `.env.example`, com as mesmas variáveis e nenhum valor sensível, para documentar a configuração necessária. O `.gitignore` passou a bloquear o `.env` (Problema 2).

### Justificativa

A configuração sensível deve viver no ambiente, não no código. O `.env.example` comunica quais variáveis a aplicação espera sem expor nenhum valor.

A remoção **não apaga o histórico**: os valores continuam acessíveis no commit `8192ae3` (tag `v0.1.0`). Optou-se por não reescrever o histórico por dois motivos. Primeiro, um segredo publicado em repositório público deve ser considerado comprometido, porque pode já ter sido copiado por clones, forks, caches ou robôs que varrem o GitHub continuamente. Segundo, a reescrita romperia o vínculo deste fork com o repositório original e invalidaria a tag de referência. A resposta adequada é a rotação das credenciais, descrita na seção "Segredos no histórico do Git".

---

## Problema 2

### Local

`.gitignore`

### Problema identificado

O `.gitignore` cobre apenas `node_modules/`, `logs/` e `dist/`. Não há proteção para arquivos de ambiente (`.env`), arquivos de credenciais, chaves privadas (`*.pem`, `*.key`) nem arquivos de backup.

### Risco

Sem essa barreira preventiva, um simples `git add .` publica qualquer arquivo sensível presente no diretório. Esta é a causa raiz dos problemas 1 e 3.

### Correção aplicada

O `.gitignore` foi ampliado para cobrir arquivos de ambiente (`.env`, `.env.*`), arquivos de credenciais (`config/credentials*.json`, `secrets/`), chaves e certificados (`*.pem`, `*.key`, `*.p12`, `*.pfx`) e backups (`*.sql`, `*.dump`, `backup/`). O `.env.example` foi mantido versionável por uma exceção explícita (`!.env.example`).

Como camada adicional, foi criado o `.gitleaks.toml` com a regra `assigned-secret`, que detecta senhas, tokens e chaves atribuídos com valor literal, inclusive os de baixa entropia que as regras padrão não detectavam.

### Justificativa

O `.gitignore` é a primeira barreira: impede que arquivos sensíveis entrem no repositório por acidente, como num `git add .`. Ele sozinho não basta, porque não protege segredos escritos dentro de arquivos legítimos. Por isso foi adotada defesa em camadas: hook de pre-commit local, varredura com gitleaks em todo pull request e *push protection* do GitHub.

A regra própria elevou a detecção no projeto de 1 para 11 segredos. Referências a variáveis de ambiente (`process.env`, `${...}`), arquivos de secrets (`/run/secrets/`), chamadas de função e substituições de comando (`$(...)`) foram excluídas da regra, porque não são valores. Essas exclusões foram calibradas à medida que o projeto evoluiu, sempre verificando que a regra continuava detectando os 11 segredos originais.

---

## Problema 3

### Local

`config/credentials.json`

### Problema identificado

Arquivo dedicado a credenciais, em texto puro e versionado, contendo usuário e senha administrativos do banco, a chave de API de pagamento com prefixo de produção (`live`) e o token da API interna.

### Risco

O arquivo concentra vários segredos em um único ponto de vazamento. O prefixo `live` indica uma chave de produção, capaz de gerar transações e cobranças reais. Como os valores divergem dos definidos no `.env`, não existe fonte única de verdade, e a rotação das credenciais fica sujeita a erro.

### Correção aplicada

O arquivo `config/credentials.json` foi removido do repositório. Antes da remoção, foi verificado que nenhum código da aplicação o lia. O padrão `config/credentials*.json` foi incluído no `.gitignore` para impedir sua reintrodução.

### Justificativa

Um arquivo que não é consumido por nenhum código e concentra credenciais em texto puro representa apenas risco, sem nenhuma função. Com a remoção, as variáveis de ambiente passam a ser a única fonte de configuração, eliminando os valores divergentes entre arquivos. A chave de pagamento com prefixo de produção (`live`) é tratada como comprometida e tem revogação prevista na seção "Segredos no histórico do Git".

---

## Problema 4

### Local

`src/config.js`

### Problema identificado

A função `getDatabaseConfig()` retorna host, usuário e senha do banco como valores literais no código, ignorando as variáveis de ambiente. O usuário configurado tem nome que indica privilégio administrativo.

### Risco

O segredo fica acoplado ao código-fonte: qualquer pessoa com acesso ao código tem acesso ao banco. Trocar a senha exige alterar o código e fazer um novo deploy, e o mesmo valor acaba sendo usado em todos os ambientes (desenvolvimento, homologação e produção).

### Correção aplicada

A função `getDatabaseConfig()` passou a ler a configuração exclusivamente de variáveis de ambiente (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` e `DB_PASSWORD`). Na inicialização, a aplicação valida as variáveis obrigatórias e, se alguma estiver ausente, interrompe a execução com uma mensagem que lista apenas os nomes das variáveis, nunca valores.

### Justificativa

Com o segredo desacoplado do código, a mesma base de código roda em qualquer ambiente com credenciais diferentes, a troca de senha não exige alteração de código nem novo deploy, e o acesso ao código-fonte deixa de conceder acesso ao banco.

A validação na inicialização (*fail fast*) evita que a aplicação suba com configuração incompleta e falhe depois, de forma silenciosa e difícil de diagnosticar. A mensagem de erro cita só os nomes das variáveis para não levar valores aos logs.

A correção também resolveu uma falha funcional que o teste em Docker revelou: como o código ignorava o ambiente, dentro do container a aplicação procurava o banco em `localhost`, que ali é o próprio container da aplicação.

---

## Problema 5

### Local

`src/database.js`

### Problema identificado

O objeto de conexão define o usuário `root` de forma fixa, sobrescrevendo o usuário configurado. Além disso, a função `connect()` imprime no log o nome do banco e o usuário da conexão.

### Risco

Viola o princípio do menor privilégio. Se a aplicação for comprometida, por exemplo via SQL injection, o atacante obtém controle total do servidor de banco: pode apagar dados, criar usuários e ler todos os bancos da instância. O log ainda revela qual identidade atacar.

### Correção aplicada

O módulo de conexão deixou de fixar o usuário `root` e passou a usar o usuário definido no ambiente. No Docker Compose, esse usuário é o `techstore_app`, criado pela imagem oficial do MySQL com privilégios restritos ao banco `techstore`. O log de conexão deixou de exibir o banco e o usuário.

### Justificativa

O princípio do menor privilégio limita o impacto de um comprometimento: se a aplicação for explorada, o atacante obtém apenas o acesso do usuário da aplicação, sem controle sobre a instância do banco, os demais bancos ou a criação de usuários. Em produção, recomenda-se restringir ainda mais o usuário às operações que a aplicação realmente executa (por exemplo, `SELECT`, `INSERT`, `UPDATE` e `DELETE`).

O log não revela mais qual identidade atacar.

---

## Problema 6

### Local

`src/app.js` – endpoints `/health` e `/config-check`

### Problema identificado

O `/health` devolve o host do banco de dados. O `/config-check` devolve o nome do banco e indica quais segredos estão configurados. Nenhum dos dois exige autenticação.

### Risco

Exposição de informação (*information disclosure*). Um atacante usa esses endpoints para reconhecimento: mapeia a infraestrutura interna e descobre quais integrações existem antes de atacar. Endpoints públicos de diagnóstico são alvo comum de enumeração automatizada.

### Correção aplicada

- O `/health` retorna apenas o status da aplicação.
- O `/config-check` passou a exigir o cabeçalho `Authorization: Bearer <token>`, validado contra o `INTERNAL_API_TOKEN`. A comparação usa `crypto.timingSafeEqual` sobre hashes SHA-256 dos dois valores. Sem token configurado no servidor, o endpoint responde `404`. A resposta deixou de incluir o nome do banco.
- O cabeçalho `X-Powered-By`, que identificava o Express, foi desativado.
- O pipeline de CI passou a verificar essas exposições a cada pull request.

### Justificativa

Ferramentas de monitoramento e orquestradores só precisam saber se a aplicação está viva; detalhes de infraestrutura não têm função nesse endpoint.

O diagnóstico de configuração continua disponível para operadores autorizados. A comparação em tempo constante impede ataques de temporização, em que o atacante mede o tempo de resposta para descobrir o token caractere por caractere. O hash prévio iguala o tamanho dos valores comparados, evitando que o tamanho do token vaze. A resposta `404` com o endpoint desativado evita anunciar a existência de um recurso protegido.

Remover o `X-Powered-By` reduz a informação disponível para buscar vulnerabilidades específicas da tecnologia.

As verificações no CI transformam as correções em testes de regressão: se alguma exposição for reintroduzida, o pull request falha.

---

## Problema 7

### Local

`scripts/backup.js`

### Problema identificado

A rotina de backup imprime a chave de API no console. O script também lê a variável `API_KEY`, que não está definida em nenhuma configuração do projeto.

### Risco

Logs são copiados para arquivos, agregadores (ELK, CloudWatch), pipelines de CI e tickets de suporte, quase sempre com retenção longa e controle de acesso mais fraco que o de um cofre de segredos. Um segredo impresso em log se multiplica fora de qualquer controle.

### Correção aplicada

O script de backup deixou de imprimir a credencial, inclusive de forma parcial, e registra apenas que ela foi carregada do ambiente. A variável `API_KEY`, que não existia em nenhuma configuração do projeto, foi substituída por `BACKUP_API_KEY`, documentada no `.env.example`. A ausência da variável interrompe a execução com erro explícito.

### Justificativa

Logs são replicados para arquivos, agregadores, pipelines de CI e tickets de suporte, com retenção longa e controle de acesso mais fraco que o de um cofre de segredos. Mesmo um mascaramento parcial, como exibir os últimos caracteres, reduz o espaço de busca de um ataque de força bruta e associa o registro à credencial.

A inconsistência no nome da variável fazia a rotina executar sem credencial sem que ninguém percebesse. Agora a falha é explícita.

---

## Problema 8

### Local

`docker-compose.yml` – variáveis de ambiente dos serviços

### Problema identificado

As senhas do usuário da aplicação e do root do MySQL estão em texto puro no arquivo versionado. Em uma das definições, a mesma senha é usada para o root e para o usuário da aplicação. A chave `MYSQL_ROOT_PASSWORD` aparece duplicada, com valores diferentes.

### Risco

O arquivo de infraestrutura publica as credenciais do banco. A senha compartilhada entre root e aplicação elimina a separação de papéis: vazar uma é vazar as duas. A chave duplicada torna ambíguo qual valor é aplicado, o que gera configuração imprevisível. Variáveis de ambiente também ficam visíveis a qualquer pessoa com acesso a `docker inspect`.

### Correção aplicada

As senhas foram removidas do `docker-compose.yml`. Os segredos passaram a ser entregues como **Docker secrets**: arquivos montados em `/run/secrets/`, apenas nos serviços que precisam deles.

- O MySQL lê as senhas por `MYSQL_PASSWORD_FILE` e `MYSQL_ROOT_PASSWORD_FILE`, recurso nativo da imagem oficial.
- A aplicação ganhou a função `readSecret`, que lê o arquivo indicado em `<NOME>_FILE` e, na execução local, recorre à variável comum definida no `.env`.
- A senha root e a senha da aplicação passaram a ser segredos distintos. O container da aplicação não recebe a senha root.
- A chave `MYSQL_ROOT_PASSWORD` duplicada deixou de existir.
- Os valores são gerados com `openssl` pelo script `scripts/generate-secrets.sh`, no diretório `secrets/`, ignorado pelo Git. O parâmetro `FORCE=1` gera novos valores para todos os segredos em um ambiente novo; com o banco em funcionamento, as senhas são rotacionadas pelo procedimento descrito em "Segredos no histórico do Git".

### Justificativa

Variáveis de ambiente ficam visíveis via `docker inspect`, são herdadas por processos filhos e costumam aparecer em dumps de erro e ferramentas de diagnóstico. Arquivos de secrets ficam restritos aos containers autorizados e não aparecem na configuração do container. A verificação no CI confirma que nenhum dos dois serviços expõe variável de ambiente com nome de senha ou token, apenas as referências `_FILE`.

Separar a senha root da senha da aplicação garante que o comprometimento da aplicação não dê controle sobre a instância do banco. A geração aleatória elimina as senhas fracas da versão original. A convenção `_FILE` é a mesma usada por orquestradores como Docker Swarm e Kubernetes, o que facilita a migração para um gerenciador de segredos em produção.

Durante os testes, foi identificado que, no Windows, o `openssl` termina a saída com CRLF. O caractere CR permanecia no arquivo; a aplicação o descartava, mas o MySQL não, gerando senhas divergentes entre as duas pontas. O script passou a remover o CR, e o login do usuário da aplicação no banco foi validado com a senha do secret.

**Limitação:** no Docker Compose sem Swarm, a permissão de leitura do arquivo de secret depende do sistema de arquivos do host. Os arquivos recebem permissão `644`, para que o usuário do container consiga lê-los, e o diretório `secrets/` recebe `700`, para impedir o acesso de outros usuários do host. No Windows, essas permissões Unix não se aplicam.

---

## Problema 9

### Local

`docker-compose.yml` – serviço do banco de dados

### Problema identificado

O mapeamento `3306:3306` publica a porta do MySQL em todas as interfaces de rede do host.

### Risco

O banco fica acessível a partir da rede, e não apenas da aplicação. Combinado com senhas fracas e já publicadas, isso permite acesso direto ao banco sem passar pela aplicação. A aplicação só precisa da rede interna do Docker Compose para se conectar.

### Correção aplicada

O mapeamento `3306:3306` foi removido. O banco passou a ficar em uma rede `backend` configurada como `internal: true`, sem rota para fora do Docker. Apenas o serviço da aplicação está conectado a essa rede. Para administração, o acesso é feito de dentro do container (`docker compose exec database mysql ...`).

### Justificativa

O banco não deve aceitar conexões que não venham da aplicação. Com a porta fechada, um atacante na rede não alcança o banco diretamente, mesmo que obtenha uma credencial. A rede interna também impede o container do banco de abrir conexões para fora, o que dificulta a exfiltração de dados. O CI verifica a cada pull request que a porta do banco não está publicada no host.

---

## Problema 10

### Local

`docker-compose.yml` – volumes e ambiente do serviço da aplicação

### Problema identificado

O volume `.:/app` monta o diretório inteiro do projeto dentro do container, incluindo `.env`, `config/credentials.json` e o diretório `.git`. O serviço também roda com `NODE_ENV=development`.

### Risco

Segredos e histórico do Git passam a existir dentro do container. Se o container for comprometido, tudo fica exposto, e o acesso de escrita do volume permite alterar arquivos do host. O modo de desenvolvimento costuma expor mensagens de erro e stack traces detalhados.

### Correção aplicada

- O volume `.:/app` foi removido. A aplicação passou a ser executada a partir de uma imagem construída por um `Dockerfile`, que copia apenas `package.json`, `package-lock.json`, `src/` e o script de backup, e instala somente as dependências de produção (`npm ci --omit=dev`) com `NODE_ENV=production`.
- O processo roda como o usuário `node`, não `root`. Os arquivos da aplicação pertencem ao `root`, então o processo consegue lê-los, mas não alterá-los.
- O `.dockerignore` exclui `.env`, `secrets/`, `.git` e demais arquivos locais do contexto de build.
- O container da aplicação roda com sistema de arquivos somente leitura (`read_only`), sem *capabilities* do Linux (`cap_drop: ALL`) e sem escalonamento de privilégios (`no-new-privileges`).
- Os dados do MySQL passaram a ficar em um volume nomeado, e os dois serviços ganharam *healthcheck*.

### Justificativa

A imagem passa a conter apenas o necessário para executar a aplicação: segredos e histórico do Git não chegam ao container. O que roda é exatamente o que foi construído e testado, sem depender de arquivos da máquina do desenvolvedor.

Usuário não-root, sistema de arquivos somente leitura e ausência de *capabilities* limitam o que um atacante consegue fazer mesmo depois de explorar a aplicação: ele não altera o código, não grava ferramentas no disco e não escala privilégios. O `.dockerignore` é uma camada adicional que impede que um futuro `COPY .` leve segredos para a imagem.

As evidências da versão original mostraram `.env`, `credentials.json` e `.git` dentro do container, com permissão de escrita total, e o processo de instalação do container gravando arquivos diretamente no diretório do projeto no host. Na versão corrigida, o CI verifica que o processo não roda como `root`, que `.env` e `.git` não existem no container, que a aplicação não tem acesso à senha root do banco e que o sistema de arquivos não aceita escrita.

---

## Segredos no histórico do Git

### Situação

Os segredos removidos nas correções continuam acessíveis no histórico do repositório, no commit `8192ae3` (tag `v0.1.0`), publicado em repositório público desde 05/10/2026. Remover um arquivo não apaga o histórico, e qualquer clone, fork ou cache feito nesse período mantém uma cópia. Por isso, **todos os segredos da versão original são tratados como comprometidos**, mesmo depois de removidos do código.

A reescrita do histórico foi descartada pelos motivos descritos no Problema 1: ela não recupera um segredo já copiado e romperia o vínculo deste fork com o repositório original. A resposta adequada é revogar ou rotacionar cada credencial.

### Plano de resposta por credencial

As ações seguem a ordem de prioridade, da credencial com maior impacto potencial para a de menor.

| Credencial | Ação | Verificação de uso indevido | Situação neste projeto |
|---|---|---|---|
| Chave de API de pagamento (`live`) | Revogar imediatamente no painel do provedor e emitir nova chave, entregue apenas pelo gerenciador de segredos de produção | Auditar transações e chamadas à API do provedor desde 05/10/2026 | Ambientes de desenvolvimento e CI usam chave de teste (`pk_test_`) gerada aleatoriamente; a chave de produção deve ser emitida pelo provedor |
| Senha root do MySQL | Rotacionar com `scripts/rotate-db-password.sh root` | Revisar os logs de conexão do banco em busca de acessos como root de origens inesperadas | Rotacionada |
| Senha do usuário da aplicação | Rotacionar com `scripts/rotate-db-password.sh app` | Revisar conexões desse usuário a partir de hosts que não sejam a aplicação | Rotacionada |
| Token da API interna | Invalidar e emitir novo token | Revisar os logs de acesso aos endpoints internos | Regenerado |
| Usuários `techstore_root` e `adminTechstore` | Remover de qualquer ambiente em que existam | Revisar o histórico de uso dessas contas | Não existem na configuração atual |

### Procedimento de rotação

**Senhas do banco.** O script `scripts/rotate-db-password.sh` rotaciona a senha sem recriar o banco e sem perda de dados:

1. gera uma nova senha aleatória;
2. aplica com `ALTER USER`, autenticando como root a partir do secret;
3. confirma que a nova senha autentica e que a antiga é rejeitada;
4. atualiza o arquivo de secret;
5. recria apenas o container da aplicação.

Nenhuma senha é passada como argumento de processo nem exibida no terminal: os valores trafegam pela entrada padrão. Se a falha ocorrer antes da aplicação no banco, a senha nova é descartada; se ocorrer depois, ela é preservada em arquivo com permissão `600` para recuperação.

O procedimento foi testado com dados no banco: após a rotação das senhas da aplicação e do root, os registros foram preservados, a aplicação permaneceu saudável e as senhas antigas foram rejeitadas.

**Tokens e chaves de API.** Apagar o arquivo correspondente em `secrets/`, executar `scripts/generate-secrets.sh`, que gera apenas os secrets ausentes, e recriar o container da aplicação.

**Atenção:** o parâmetro `FORCE=1` do `generate-secrets.sh` regenera todos os secrets e só deve ser usado em ambiente novo. Com o banco já inicializado, o MySQL ignora os secrets, e as senhas ficariam divergentes.

### Armazenamento por ambiente

| Ambiente | Onde ficam os segredos | Características |
|---|---|---|
| Desenvolvimento | `.env` (execução com `npm start`) e `secrets/` (Docker Compose), locais e ignorados pelo Git | Valores aleatórios gerados por script, exclusivos de cada máquina |
| CI | Gerados a cada execução do pipeline | Descartados ao final; nunca reutilizados nem persistidos |
| Produção | Gerenciador de segredos: GitHub Environments (configurado neste repositório) ou serviços como AWS Secrets Manager, Azure Key Vault e HashiCorp Vault | Acesso restrito, trilha de auditoria e rotação periódica |

O repositório tem um environment `production` configurado no GitHub, com os secrets `DB_ROOT_PASSWORD`, `DB_PASSWORD`, `INTERNAL_API_TOKEN` e `BACKUP_API_KEY`. Os valores foram gerados aleatoriamente e enviados diretamente ao GitHub, sem exibição em nenhum momento. Somente workflows executados a partir da branch `main` podem acessá-los.

### Política de rotação

| Tipo de credencial | Periodicidade |
|---|---|
| Senhas de banco de dados | A cada 90 dias |
| Tokens internos | A cada 90 dias |
| Chaves de provedores externos | Conforme a política do provedor, no máximo a cada 90 dias |

Em qualquer um destes casos, a rotação é **imediata**: suspeita de vazamento, segredo detectado em código, log ou histórico, ou saída de uma pessoa que tinha acesso à credencial.

### Camadas de prevenção

O projeto passou a ter defesa em camadas contra novos vazamentos:

1. **`.gitignore`**, que impede o versionamento de arquivos sensíveis;
2. **hook de pre-commit** com gitleaks, que bloqueia o commit na máquina do desenvolvedor;
3. **gitleaks no CI** com regra própria para segredos de baixa entropia, em todo pull request;
4. ***push protection*** do GitHub, que recusa o push de segredos de provedores conhecidos;
5. **rulesets** que impedem merge na `main` sem os checks de segurança aprovados, sem exceção para administradores;
6. **testes de regressão** no CI, que falham se alguma das exposições corrigidas voltar.