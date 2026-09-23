# rer-dsp-core

Este módulo é parte do [DSP](../index.md) — veja a documentação completa em [rer-dsp-docs](../index.md). As informações abaixo tratam apenas deste módulo.

## Objetivo

O `rer-dsp-core` é o hub de orquestração Docker Compose do DSP. Ele **não contém código de aplicação/domínio** — sua responsabilidade é preparar e subir a infraestrutura (bancos, GeoServers, gateway, jobs de migração e geo-file) e orquestrar o build dos demais módulos.

```mermaid
flowchart TD
  core["rer-dsp-core"]
  be["rer-dsp-backend"]
  fe["rer-dsp-frontend"]
  job["rer-dsp-job-data-migration"]
  geoFile["rer-dsp-job-geo-file-generation"]
  storage["dsp-object-storage (SeaweedFS)"]
  gs["2 GeoServers + 2 bancos Postgres/PostGIS"]
  gw["dsp-gateway"]

  core --> be
  core --> fe
  core --> job
  core --> geoFile
  core --> storage
  core --> gs
  core --> gw
```

## Responsabilidades

- Configuração de exemplo do adotante.
- Conteúdo de exemplo da página About (`config/about/`).
- SQL de inicialização dos bancos.
- GeoServer Exhibition (mapa) e GeoServer Download (WFS de exportação).
- Gateway nginx (`dsp-gateway`) como porta de entrada única da stack.
- Object storage SeaweedFS (`dsp-object-storage`, profile `object-storage`) e job geo-file (`dsp-job-geo-file-generation`, mesmo profile) — obrigatórios no adotante real; a Demo Brasil não sobe esses serviços.
- Job de migração (`dsp-job-migration`, profile `migration`).
- Três scripts operacionais: `./config.sh`, `./setup.sh`, `./start.sh`.
- Clone automático dos repositórios irmãos quando ausentes (com preview da estrutura de pastas antes da confirmação). `./config.sh` também clona o job se faltar.

## Pré-requisitos

| Requisito | Detalhe |
|-----------|---------|
| Shell Bash | Os scripts (`config.sh`, `setup.sh`, `start.sh`) são `bash` puro. Nativo em Linux e macOS; no Windows requer WSL2 (não há suporte nativo via PowerShell/cmd). |
| Git | Clonar repositórios irmãos ausentes (automático via scripts ou manual); necessário apenas se os repos ainda não existirem |
| Docker 24+ com Compose v2 | Usado para subir bancos, GeoServer e os demais módulos |
| Python 3 | Usado pelo wizard `./config.sh` |

## Os três scripts

### `./config.sh`

Wizard interativo que grava `config/adopter/adopter-config.yaml` e, na reaplicação, gera os arquivos operacionais (lista abaixo). Entrada: `./config.sh` (sem argumentos).

- `config/installation/installation-config.json` — hierarquia, telas, KPIs, `map.initialView`, painel de detalhe da AOI.
- `config/map/mapLayersConfig.json` — grupos e camadas WMS, SRIDs.
- `config/downloads/downloadThemesConfig.json` — temas da tela Downloads.
- `config/about/about-config.json` — índice da página About (quando habilitada); Markdown em `config/about/`.
- `config/Job-Data-Migration/application/application.yaml` — datasources e mapeamento ETL.
- `config/Job-Geo-File-Generation/application/application.yaml` — object storage (SeaweedFS); **sem** cron no YAML.
- `.env` — `DSP_SOURCE_*`, `DSP_OBJECT_STORAGE_*` e demais chaves que o wizard preenche.

Esses artefatos operacionais **não devem ser editados manualmente** — são derivados e **regenerados** a cada reaplicação de `./config.sh`. Ajuste sempre `config/adopter/adopter-config.yaml` (wizard ou editor) e depois reaplique.

Rodar sem argumentos (`./config.sh`). Antes do wizard, o script confere os repositórios irmãos (`rer-dsp-backend`, `rer-dsp-frontend`, `rer-dsp-job-data-migration`, `rer-dsp-job-geo-file-generation`) e oferece clonar o que faltar.

O wizard **não** pergunta horário de job batch nem grava `DSP_MIGRATION_CRON` ou `DSP_GEO_FILE_GENERATION_CRON`. Reaplicar (opção **1**) não altera crons no `.env`.

**Primeira execução** (sem `adopter-config.yaml` ainda): o script pergunta como configurar:

| Opção | Ação |
|-------|------|
| 1 | **Configuração guiada** — wizard passo a passo |
| 2 | **Configuração existente** — coloque seu `adopter-config.yaml` no caminho indicado e reaplique depois (opção 1 do menu abaixo) |

**Execuções seguintes** (quando o YAML já existe):

| Opção | Ação |
|-------|------|
| 1 | Reaplicar a configuração existente sem passar pelo wizard novamente |
| 2 | Editar a configuração existente (reabre o wizard já preenchido com os valores atuais) |
| 3 | Recomeçar do zero a partir do template (`adopter-config.yaml.example`), descartando o arquivo atual |

!!! tip "Duas formas de configurar"
    Você pode seguir o **wizard passo a passo** (recomendado — cada pergunta explica o campo e onde o valor é usado, mostrando o valor atual/padrão entre colchetes e mantendo-o se você só apertar Enter), **ou editar diretamente** o arquivo `config/adopter/adopter-config.yaml` num editor de texto, usando `config/adopter/adopter-config.yaml.example` como referência de estrutura. Depois de editar o adotante, rode `./config.sh` e escolha **1 — Reaplicar** para regenerar os JSON/YAML operacionais. **Não** edite `installation-config.json`, `mapLayersConfig.json`, `downloadThemesConfig.json` nem os `application.yaml` dos jobs à mão.

!!! warning "Rebuild após alterar a configuração"
    Os arquivos operacionais gerados em `config/` são **copiados para dentro das imagens Docker no build** (`select-runtime-config.sh` + contexto `dsp_config`). Depois de `./config.sh`, rode `./setup.sh` ou `./start.sh` para rebuildar os containers que consomem essa configuração (backend, GeoServers, job de migração).

O wizard é dividido em **6 etapas**. Em cada uma, o operador responde perguntas guiadas (com explicação do campo e do impacto) até cobrir a configuração necessária e a personalização do adotante:

| Etapa | O que é configurado | Impacto |
|-------|---------------------|---------|
| **1 — Banco de origem** | URL JDBC da fonte, usuário/senha de leitura (`DSP_SOURCE_DB_USER` / `DSP_SOURCE_DB_PASSWORD`) | Job de migração e `.env` |
| **2 — Tabelas, colunas e camadas** | Para L1/L2/L3/AOI: tabela, PK (**uma** coluna; composta não suportada), `parent_key` (L2/L3), nome, geometria, SRID, `created_at_column` (obrigatório), `updated_at_column` (opcional), `where_clause`. Na AOI: `territory_level_3_column`, `additional_columns`. Camadas genéricas em `etl.layers[]` (ETL + mapa + downloads num único bloco) | Plano ETL, `mapLayersConfig.json` e `downloadThemesConfig.json`. Camadas extras: [Migração de camadas genéricas](job-data-migration/generic-layers.md) |
| **3 — Aplicação** | Label do KPI de área de interesse (`area_of_interest`), formatos de data e data-hora | Dashboard, listagens e detalhe |
| **4 — Interface** | Labels da hierarquia, títulos das telas, campos do painel de detalhe da AOI, `map.initialView` (`territorial_bbox` / `manual` / `planet`), grupos e estilos das camadas fixas de mapa | Frontend, seletor de camadas e estilos publicados no GeoServer |
| **5 — KPIs** | Cores dos cards, unidade de área da AOI, quantidade e mapeamento dos KPIs de tema (0–4) | Cards de KPI e cálculos no job |
| **6 — About** (opcional) | Habilitar página About, título do banner, abas (label + arquivo `.md` / `.markdown`; o wizard pode copiar de qualquer pasta para `config/about/`) | `about-config.json` + conteúdo em `config/about/` |

No terminal o wizard mostra **5 estágios** numerados (1–5) mais o bloco **About** opcional ao final — na documentação, o About conta como **6ª etapa**.

**Object storage (SeaweedFS)** não é perguntado no wizard. Credenciais e endpoint ficam em `environment.object_storage` no `adopter-config.yaml` (veja `adopter-config.yaml.example`); o `./config.sh` copia isso para `DSP_OBJECT_STORAGE_*` no `.env` na reaplicação. A **agenda** do job geo-file (`DSP_GEO_FILE_GENERATION_CRON`) vem do `./setup.sh`, não desta etapa.

O `./config.sh` (opção **2 — editar**) reabre esse mesmo wizard de 6 etapas com os valores atuais preenchidos.

#### SQL avançado em `source_table` (níveis fixos)

No wizard, `source_table` deve ser `schema.tabela`. Para subconsultas SQL (JOINs, aliases), edite diretamente o `adopter-config.yaml` com bloco YAML dobrado (`>-`), conforme o exemplo em `adopter-config.yaml.example`. Os nomes das colunas abaixo devem bater com os aliases do `SELECT`. Depois, `./config.sh` → **Reaplicar**.

#### Camadas genéricas unificadas (`etl.layers[]`)

Cada item alimenta **três destinos** a partir de uma única configuração:

| Campo no `adopter-config.yaml` | Onde é usado |
|----------------------------------|--------------|
| `source_table`, colunas de papel, `where_clause`, `srid` | `application.yaml` → job de migração |
| `layer_name`, `display_name`, `group_key`, `active_default`, `color`, `fill_color` | `mapLayersConfig.json` → mapa e GeoServer |
| (derivado de `layer_name` + `display_name`) | `downloadThemesConfig.json` → tela Downloads (`strategy: aoi_linked`) |

A mesma `source_table` pode aparecer **mais de uma vez** se `layer_name` (e portanto a tabela destino `dsp.<nome>`) for distinto. Ao adicionar outra camada com a mesma origem no wizard, os campos de estrutura (PK, FK, geometria, datas, SRID) são **reutilizados** como padrão.

Para **não** migrar ou exibir uma camada, remova-a de `etl.layers[]` e reaplique — não use `enabled: false` no YAML do adotante.

Na **etapa 6/6**, o adotante pode recusar a página About; nesse caso ela permanece desabilitada. Se habilitar, o wizard valida extensão e existência dos arquivos Markdown e gera ids de aba (`tab-1`, `tab-2`, …) em `about-config.json`.

!!! tip "Contrato protegido"
    O arquivo gerado contém apenas os campos editáveis pelo adotante. Chaves de contrato internas do DSP (IDs de camada WMS, nomes de tabela alvo, códigos de KPI) permanecem fixas nos templates do core e não são expostas no wizard.

#### Página About (`config/about/`)

A pasta `config/about/` traz o conteúdo de exemplo da página About do frontend: `about-config.json.example` (índice de exemplo) e os Markdown de demonstração (`*.quickstart.md.example`, copiados no modo Demonstração). O fluxo normal do wizard é informar um Markdown de qualquer pasta do computador, que é copiado para `config/about/`.

O YAML do adotante (`config/adopter/adopter-config.yaml` / `.yaml.example`) tem uma seção `about` com os campos:

| Campo | Função |
|-------|--------|
| `enabled` | Habilita/desabilita a página About customizada |
| `banner_title` | Título exibido no banner da página |
| `tabs` | Lista de `{label, file}` — no wizard, `file` pode ser de qualquer pasta (copiado para `config/about/`); na edição manual do YAML, só o nome do arquivo já presente em `config/about/` (caminhos absolutos ou fora da pasta são recusados no apply) |

`apply_config()` gera `config/about/about-config.json` com ids automáticos (`tab-1`, `tab-2`, …) a partir da ordem das abas. O backend lê esses arquivos em `/config/about/` **dentro da imagem** (copiados no build). Variáveis: `DSP_ABOUT_CONFIG_FILE` e `DSP_ABOUT_CONTENT_DIR` (`.env.example`).

### `./setup.sh`

Prepara bancos, GeoServer e (no fluxo real) a primeira migração. Roda sem argumentos e apresenta um menu com **três opções**:

| Opção | Ação |
|-------|------|
| **1 — Demonstração** | Seed sintético do Brasil, **sem** fonte JDBC nem job de migração. Indicada para explorar a UI ou avaliar a stack. |
| **2 — Adotante real (ETL via JDBC)** | Requer `./config.sh` antes. Pergunta **quando** e **como** a migração deve rodar (submenu abaixo). Grava em `dsp-db` + `dsp-geoserver-db`. |
| **3 — Status / cleanup / sair** | Status dos containers e URLs; opcionalmente remove recursos Docker do projeto. Não sobe nem migra. |

#### Submenu da opção 2 — plano de migração

**1. Quando deve rodar a carga inicial?**

| Escolha | Efeito |
|---------|--------|
| **Run now** | Primeira migração **durante** este `./setup.sh` |
| **Schedule for later** | Bancos ficam vazios no setup; primeira carga em `DSP_MIGRATION_SCHEDULED_AT` |

**2. Como a migração deve se comportar depois?**

| Escolha | Run now | Schedule for later |
|---------|---------|-------------------|
| **One-time** | `once`: migra no setup e **desliga** o container do job | `scheduled-once`: espera a data/hora, migra uma vez, publica GeoServers e sai |
| **Continuous (periodic re-sync)** | `continuous`: migra no setup e mantém o container com **supercronic** em `DSP_MIGRATION_CRON` | `continuous` + `DSP_MIGRATION_SCHEDULED_AT`: primeira carga na data escolhida, depois cron |

No modo **Continuous**, o script pergunta **How often should the data be synchronized after the initial migration?**: todo dia num horário; a cada N horas; ou a cada N minutos (1–59, útil para teste local). O horário de *Schedule for later* é reutilizado se a escolha for “todo dia”.

Em seguida (ainda no step 3 do setup, opção 2), pergunta o **cron de pré-geração** de arquivos de download — expressão Unix de **5 campos** para `DSP_GEO_FILE_GENERATION_CRON` (padrão: valor atual do `.env` ou `0 2 * * *`). Deve ficar numa janela **depois** da migração periódica, quando houver `DSP_MIGRATION_CRON`. O adotante não digita a expressão de migração manualmente; para pré-geração, informa o cron diretamente ou aceita o padrão com Enter.

Valores de migração e pré-geração são gravados no `.env` no **fim** do setup (step 9), junto com `DSP_MIGRATION_*`. Reexecutar `./setup.sh` (adotante real) repete as perguntas, usando o `.env` como padrão.

Fuso da migração: `DSP_MIGRATION_TZ` no `.env` (veja `.env.example`). Pré-geração herda `DSP_MIGRATION_TZ` quando `DSP_GEO_FILE_GENERATION_TZ` está vazio.

| Combinação | `DSP_MIGRATION_EXECUTION_MODE` | Container do job após o setup |
|------------|-------------------------------|------------------------------|
| Run now + One-time | `once` | Desligado |
| Schedule + One-time | `scheduled-once` | Ativo até a carga; depois sai |
| Run now + Continuous | `continuous` | Ativo (supercronic) |
| Schedule + Continuous | `continuous` + `DSP_MIGRATION_SCHEDULED_AT` | Ativo (espera, depois supercronic) |

Se `config/Job-Data-Migration/application/application.yaml` ainda for idêntico ao template (`.example`), o `setup.sh` interrompe com erro — rode `./config.sh` ou edite o arquivo antes.

#### Bancos e publicação de camadas

Antes de migrar, o script **espera a inicialização completa do PostgreSQL** (`pg_isready` + schemas `dsp` e `data_migration` criados pelo SQL de init).

| Carga inicial | GeoServers no fim do setup |
|---------------|----------------------------|
| **Run now** (migração no setup) | `populate_geoserver.sh` publica camadas nos dois GeoServers (REST) |
| **Schedule for later** | GeoServers sobem **sem** camadas; `publish_geoservers.sh` no entrypoint do job roda após a **primeira carga agendada** com sucesso |

AOI e camadas genéricas só existem nos GeoServers depois que o job populou o `geoserver-db`.

### `./start.sh`

Use **depois** do `./setup.sh`. Não roda migração, seed, populate de GeoServer nem sobe bancos/jobs — apenas **rebuilda e liga** `dsp-backend`, `dsp-frontend` e `dsp-gateway` (com `docker compose … --no-deps`, para não religar a infra via `depends_on`).

| Passo do script | O que faz |
|-----------------|-----------|
| 1 — Pré-requisitos | Docker; cria/valida `.env` |
| 2 — Repositórios | Confere `rer-dsp-backend` e `rer-dsp-frontend` (`DSP_BACKEND_PATH` / `DSP_FRONTEND_PATH`, padrão `../…`) |
| 3 — Config em disco | Exige `installation-config.json`, `mapLayersConfig.json` e `downloadThemesConfig.json` (válidos; tipicamente gerados pelo `./config.sh` ou quickstart na demo) |
| 4 — Infraestrutura | **Só verifica** se os containers esperados já estão rodando (falha com hint se não). Demo: dois bancos + dois GeoServers. Adotante real: o mesmo núcleo +, conforme o `.env`, job de migração, `dsp-object-storage` e job geo-file |
| 5 — URL do site | Mostra a URL pública do frontend (`dsp_public_base_url` + `VITE_BASE_URL`) |
| 6 — Aplicação | Build/up de backend, frontend e gateway |
| Ao final | Resumo da stack, URLs e dicas (incl. geo-file quando aplicável) |

Camadas no mapa e primeira carga de dados continuam sendo responsabilidade do **`./setup.sh`** (ou do job agendado depois). Se você fez `docker compose down` sem `-v`, o `./start.sh` **não** religa bancos nem GeoServers — siga o comando que o script imprime no erro ou rode `./setup.sh` de novo.

## Bancos e GeoServer

Só os bancos publicam porta no host. Os serviços HTTP ficam acessíveis apenas pelo gateway. Os dois jobs não expõem HTTP — sobem por profile do Compose.

| Serviço | Acesso | Papel |
|---------|--------------|-------|
| dsp-db | porta 20654 | Banco operacional — negócio + bbox/centroid. Metadados Spring Batch: schema `data_migration` (job de migração) e schema `geo_file_generation` (job geo-file) |
| GeoServer DB (dsp-geoserver-db) | porta 20656 | Geometria completa `dsp.*` |
| Job de migração (`dsp-job-migration`) | profile `migration`, sem porta HTTP | ETL da origem JDBC para dsp-db e geoserver-db |
| Object storage (`dsp-object-storage`) | profile `object-storage`, porta host `8333` (opcional) | SeaweedFS (`weed mini`) — API S3 do DSP. Obrigatório no adotante real |
| Job geo-file (`dsp-job-geo-file-generation`) | profile `object-storage`, sem porta HTTP | Pré-gera CSV de download no SeaweedFS. Obrigatório no adotante real |
| GeoServer Exhibition | via gateway, `/geoserver-exhibition/` | WMS/WFS de mapa a partir do geoserver-db |
| GeoServer Download | via gateway, `/geoserver-download/` | WFS de downloads (consumido pelo backend) |

## Fluxo dual-write

```mermaid
flowchart LR
  src[(Fonte JDBC do adotante)] --> job[Job de migração]
  job -->|"negócio + bbox/centroid"| dspdb[(dsp-db)]
  job -->|"geometria completa"| exdb[(dsp-geoserver-db)]
  exdb --> gsEx[GeoServer Exhibition WMS]
  exdb --> gsDl[GeoServer Download WFS]
  exdb --> geoFile[Job geo-file]
  geoFile -->|CSV pré-gerado| s3[(dsp-object-storage SeaweedFS)]
  dspdb --> be[Backend serve API]
  be --> fe[Frontend consome API + WMS]
  be -->|WFS downloads| gsDl
  be -->|CSV S3-first| s3
```

## Gateway (`dsp-gateway`)

Container nginx que é a porta de entrada única da stack. Frontend, backend e os dois GeoServers não
publicam porta no host — tudo entra por `DSP_GATEWAY_HOST_PORT` (default `8026`).

A configuração fica em `config/Gateway/nginx/default.conf.template`, é **copiada para a imagem** no `docker compose build` (`/etc/nginx/templates/`) e processada por `envsubst` quando o container sobe, substituindo apenas as variáveis `DSP_*`. O volume `dsp_gateway_cache` guarda só o cache, não os templates.

| Rota externa | Destino interno |
|--------------|-----------------|
| `/` | redireciona para `/dsp/` |
| `/dsp/` | `dsp-frontend:8080` |
| `/dsp-backend/` | `dsp-backend:8080` (acompanha `DSP_BACKEND_CONTEXT_PATH`) |
| `/geoserver-exhibition/` | `dsp-geoserver-exhibition:8080/geoserver/` |
| `/geoserver-download/` | `dsp-geoserver-download:8080/geoserver/` |
| `/gateway/health` | resposta local do nginx |

Os dois GeoServers respondem em `/geoserver` internamente, então cada um recebe um prefixo externo
próprio e um `rewrite`. Cada um também recebe `PROXY_BASE_URL` com a sua URL pública, para que os
links do GetCapabilities e da interface web saiam corretos.

Como o gateway resolve os upstreams em runtime pelo DNS do Docker, ele sobe mesmo com algum serviço
parado — responde `502` em vez de falhar no boot. Isso é o que permite usar o modo demo do
`./setup.sh`, que não sobe backend nem frontend.

### Cache

O cache já está configurado, mas vem **desligado**. Ele cobre apenas os endpoints WMS/WFS
(`/geoserver-exhibition/<workspace>/wms`, `/wfs` e os equivalentes em `/geoserver-download/`), que não têm
sessão — a UI web e a REST do GeoServer ficam de fora para não quebrar o login do admin.

Para ligar, deixe `DSP_GATEWAY_CACHE_BYPASS` vazio no `.env` e recrie o container:

```bash
# .env
DSP_GATEWAY_CACHE_BYPASS=
DSP_GATEWAY_CACHE_TTL=10m

docker compose --env-file .env up -d --force-recreate dsp-gateway
```

O header `X-Cache-Status` (`HIT`, `MISS`, `BYPASS`) sai em toda resposta dos GeoServers e serve para
conferir o comportamento. Para limpar o cache, remova o volume `dsp_gateway_cache`.

## URLs padrão

| Serviço | URL |
|---------|-----|
| Frontend | http://localhost:8026/dsp/ |
| Backend API | http://localhost:8026/dsp-backend |
| GeoServer Exhibition | http://localhost:8026/geoserver-exhibition/web/ |
| GeoServer Download | http://localhost:8026/geoserver-download/web/ |
| Health do gateway | http://localhost:8026/gateway/health |

## Variáveis de ambiente relevantes (`.env` do core)

O `.env` é criado automaticamente na primeira execução de `./config.sh`, `./setup.sh` ou `./start.sh` (a partir de `.env.example`). Não é necessário copiá-lo manualmente.

O `./config.sh` grava JDBC, SRID e `DSP_OBJECT_STORAGE_*` (a partir de `environment` no adopter YAML) no `.env`. As **agendas** de migração e geo-file vêm do `./setup.sh` (adotante real). Compreender as variáveis abaixo ajuda a personalizar a instalação e a solucionar problemas.

| Variável | Função |
|----------|--------|
| `DSP_SOURCE_JDBC_URL` | URL JDBC da fonte de dados do adotante (banco a migrar) |
| `DSP_SOURCE_DB_USER` / `DSP_SOURCE_DB_PASSWORD` | Credenciais da fonte JDBC |
| `DSP_MIGRATION_EXECUTION_MODE` | `once`: carga no setup e desliga o job. `continuous`: supercronic em `DSP_MIGRATION_CRON`. `scheduled-once`: uma carga em `DSP_MIGRATION_SCHEDULED_AT` |
| `DSP_MIGRATION_CRON` | Cron Unix de 5 campos gerado pelo setup (ex.: `0 */6 * * *` ou `*/2 * * * *`). Só `continuous` |
| `DSP_MIGRATION_SCHEDULED_AT` | Data/hora da primeira carga quando o setup escolhe **Schedule for later** |
| `DSP_MIGRATION_TZ` | Fuso IANA do relógio (`.env.example`) |
| `DSP_GEO_FILE_GENERATION_EXECUTION_MODE` | `continuous` (padrão): supercronic em `DSP_GEO_FILE_GENERATION_CRON`. `once`: uma execução via `compose run` |
| `DSP_GEO_FILE_GENERATION_CRON` | Cron Unix de 5 campos para o job geo-file (ex.: `0 2 * * *`). Definido no `./setup.sh` (adotante real), **não** no `./config.sh` |
| `DSP_GEO_FILE_GENERATION_TZ` | Fuso da pré-geração; vazio herda `DSP_MIGRATION_TZ` |
| Credenciais dos 2 bancos do core | Usuário/senha de dsp-db e dsp-geoserver-db |
| `DSP_GEOSERVER_WFS_BASE_URL` | URL WFS do GeoServer Download na rede Docker (backend → download) |
| `DSP_PUBLIC_BASE_URL` | URL pública da stack (`http://localhost:8026`). Alimenta URLs WMS/WFS do `./config.sh` e `PROXY_BASE_URL` dos GeoServers |
| `DSP_GATEWAY_HOST_PORT` | Porta HTTP do gateway (default `8026`) |
| `DSP_GATEWAY_CACHE_BYPASS` / `DSP_GATEWAY_CACHE_TTL` | Liga/desliga o cache do nginx e define o TTL |
| `DSP_CORS_ALLOWED_ORIGINS` | Origens permitidas no CORS do backend |
| `DSP_ABOUT_CONFIG_FILE` / `DSP_ABOUT_CONTENT_DIR` | Índice About e pasta Markdown (default `file:/config/about/…`) |
| `DSP_OBJECT_STORAGE_ENDPOINT` | Quando definido, habilita o job geo-file (`profile=geo-file`) |
| Build args do frontend | `VITE_BASE_URL`, `VITE_DSP_API_URL` — definem base path e URL da API usadas no build da imagem |
| `DSP_OBJECT_STORAGE_*` / `DSP_OBJECT_STORAGE_HOST_PORT` | Endpoint interno do SeaweedFS (`http://dsp-object-storage:8333`), bucket, credenciais e porta no host para diagnóstico — derivados de `environment.object_storage` no reaplicar do `./config.sh` (não perguntados no wizard). Demo Brasil deixa o endpoint vazio |
| `DSP_BACKEND_PATH` / `DSP_FRONTEND_PATH` / `DSP_JOB_MIGRATION_PATH` / `DSP_JOB_GEO_FILE_GENERATION_PATH` | Paths dos repositórios irmãos usados na orquestração de build |

Veja também: [Instalação completa](../guides/full-installation.md), [Bancos de dados](../architecture/databases.md).

## Estrutura de configuração gerada

`config/adopter/adopter-config.yaml` é o arquivo central produzido pelo wizard `./config.sh`. A partir dele são derivados os arquivos operacionais consumidos por backend (`installationConfig.json`, `mapLayersConfig.json`, `downloadThemesConfig.json`, `about-config.json`) e pelo job de migração (`application.yaml`), evitando que cada módulo precise ser configurado manualmente e de forma isolada.

O wizard `./config.sh` produz um único `adopter-config.yaml` e, a partir dele, deriva todos os artefatos operacionais consumidos pelos demais módulos. O `downloadThemesConfig.json` entra nesse pipeline como catálogo de temas para a tela de Downloads e para o proxy WFS do backend. O `about-config.json` entra nesse pipeline como índice de conteúdo (banner + abas) da página About do frontend.

```mermaid
flowchart LR
  configSh["./config.sh"]
  configSh --> installJson["installation-config.json"]
  configSh --> mapJson["mapLayersConfig.json"]
  configSh --> downloadJson["downloadThemesConfig.json"]
  configSh --> aboutJson["about-config.json"]
  configSh --> appYaml["Job-Data-Migration application.yaml"]
  configSh --> geoYaml["Job-Geo-File-Generation application.yaml"]
  configSh --> dotenvStorage[".env DSP_OBJECT_STORAGE_* / DSP_SOURCE_*"]
  installJson --> build["docker compose build<br/>contexto dsp_config"]
  mapJson --> build
  downloadJson --> build
  aboutJson --> build
  appYaml --> build
  geoYaml --> build
  dotenvStorage --> setupSh["./setup.sh grava crons no .env"]
  build --> backendImg["dsp-backend /config"]
  build --> geoserverImg["GeoServers /config"]
  build --> jobImg["dsp-job-migration /config"]
```

- **`./config.sh`** — ponto de entrada do adotante; wizard, reaplicação ou recriação do `adopter-config.yaml` e geração dos JSON/YAML operacionais listados acima.
- **`select-runtime-config.sh`** — no build Docker, escolhe o arquivo ativo ou o `.example` e copia para `/config` dentro da imagem.
- **`installation-config.json`** — labels, hierarquia, telas, KPIs e `screens.home.detail.fields` (`DSP_INSTALLATION_CONFIG_FILE`). Esse array **não** vai para o `application.yaml` do job.
- **`mapLayersConfig.json`** — grupos e camadas WMS; publicadas nos GeoServers pelo `populate_geoserver.sh`.
- **`downloadThemesConfig.json`** — temas de download (AOI + `etl.layers[]`); `wfsBaseUrl` em `${DSP_PUBLIC_BASE_URL}/geoserver-download/dsp/wfs`.
- **`about-config.json`** — índice About (`enabled`, `bannerTitle`, `tabs` com ids `tab-1`, `tab-2`, …).
- **`application.yaml`** — plano ETL. Copiado para a imagem do job no build (com entrypoint e scripts de publicação GeoServer).
- **`config/Job-Geo-File-Generation/application/application.yaml`** — S3 do job de pré-geração (sem cron; agenda só no `.env` via `./setup.sh`).
- **Imagens `dsp-backend`, GeoServers, `dsp-job-migration`, bancos e `dsp-gateway`** — configs e SQL de init copiados no build via `dsp_config`; volumes guardam só dados (e cache do gateway).
- **Imagem `dsp-object-storage`** — SeaweedFS (`weed mini`) com credenciais em `s3.json` na imagem. Volume `dsp_object_storage_data` guarda os objetos; tamanho e quantidade de volumes internos são calculados pelo `weed mini` conforme o espaço livre no volume Docker.

Veja também: [Fluxo de dados](../architecture/data-flow.md) (runtime) e [rer-dsp-backend](backend.md) (variáveis de ambiente de downloads).
