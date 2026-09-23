# rer-dsp-backend

Este módulo é parte do [DSP](../index.md) — veja a documentação completa em [rer-dsp-docs](../index.md). As informações abaixo tratam apenas deste módulo.

## Objetivo

O `rer-dsp-backend` é a API REST do DSP: expõe dados de negócio, hierarquia territorial, downloads e configuração de mapas para o frontend e outros consumidores.

## Responsabilidades

- Servir dados de negócio a partir do banco operacional (`dsp-db`) — nunca geometria completa.
- Expor configuração de instalação (labels, hierarquia, telas, KPIs) via arquivo externo, sem precisar alterar código.
- Expor configuração de camadas de mapa (base maps e layers) consumida pelo componente de mapa do frontend.
- Fazer proxy WFS ao GeoServer Download para busca e download de arquivos CSV na tela de Downloads.

## Stack

| Item | Valor |
|------|--------|
| Linguagem / runtime | Java 21 |
| Framework | Spring Boot 3.4.2 |
| Build | Gradle |
| ORM | JPA/Hibernate + hibernate-spatial + PostGIS |
| Documentação de API | springdoc-openapi |
| Boilerplate | Lombok |

## Como executar

```bash
./gradlew bootRun
```

Ou via Docker, orquestrado pelo `rer-dsp-core` — que oferece dois modos: [demo](../guides/quick-start.md) (seed sintético, sem banco externo) ou [instalação real](../guides/full-installation.md) (dados do adotante via fonte JDBC). No Docker o container não publica porta no host: a API é alcançada pelo gateway do core, em `/dsp-backend`.

## Variáveis de ambiente

Definidas com valores default em `src/main/resources/application.properties`.

| Variável | Função |
|----------|--------|
| `SERVER_SERVLET_CONTEXT_PATH` | Context-path da API (default `/dsp-backend`). O gateway usa o mesmo prefixo externamente, sem rewrite |
| `DSP_CORS_ALLOWED_ORIGINS` | Origens permitidas no CORS. Pelo gateway o frontend chama a API na mesma origem; isso cobre consumidores externos e o dev local |
| `DSP_INSTALLATION_CONFIG_FILE` | Caminho do JSON de configuração de instalação |
| `DSP_MAP_LAYERS_FILE` | Caminho do JSON de camadas de mapa |
| `DSP_DOWNLOAD_THEMES_FILE` | Caminho do JSON de temas de download (`downloadThemesConfig.json`) |
| `DSP_ABOUT_CONFIG_FILE` | Caminho do JSON de índice da página About (`about-config.json`) |
| `DSP_ABOUT_CONTENT_DIR` | Caminho da pasta com os arquivos Markdown das abas da página About |
| `DSP_GEOSERVER_WFS_BASE_URL` | URL base WFS do GeoServer Download para exportação de downloads |
| `DSP_ABOUT_CONFIG_FILE` / `DSP_ABOUT_CONTENT_DIR` | Página About customizada (gerada pelo `./config.sh` do core) |
| `SPRING_DATASOURCE_URL` / `SPRING_DATASOURCE_USERNAME` / `SPRING_DATASOURCE_PASSWORD` | Conexão com `dsp-db` |
| `SPRING_JPA_HIBERNATE_DDL_AUTO` | Gestão de schema (manter `none`) |

## Endpoints REST

| Endpoint | Descrição |
|----------|-----------|
| `GET /config/installation` | Configuração de instalação: hierarquia, telas, KPIs e `screens.home.detail.fields` |
| `GET /geoServices/getRegions` | Lista de regiões |
| `GET /state/getAll` | Lista de estados |
| `GET /state/getCitiesByUf/{idState}` | Cidades por estado |
| `GET /state/getUfsByRegion/{region}` | Estados por região |
| `GET /downloads/themes` | Temas disponíveis para download (catálogo em `downloadThemesConfig.json`) |
| `GET /config/about` | Conteúdo configurável da página About: `enabled`, `bannerTitle` e `tabs[]` (`id`, `label`, `content` em Markdown) |
| `POST /downloads/search` | Busca itens por hierarquia/tema (nível 2 obrigatório, nível 3 opcional) |
| `GET /downloads/file` | Download de arquivo CSV via proxy WFS |
| `GET /map/getBaseMaps` | Mapas base configurados |
| `GET /map/getLayers` | Camadas de mapa (via `DSP_MAP_LAYERS_FILE`) |
| `POST /totalizer/` | Totalizadores |
| `GET /totalizer/getDeatilsByIdentifier/{identifier}` | Detalhe por identificador |
| `GET /totalizer/getDetailsByCoordinates` | Detalhe por coordenadas |
| `GET /territory/options` | Opções de território por hierarquia |
| `GET /territory/boundary-box` | Bounding box de território |

## Configuração de instalação (labels, telas, KPIs)

Os **dados** territoriais (unidades L1/L2/L3) ficam nas tabelas `dsp.territory_level_*`. Os **nomes exibidos** dos filtros ("Level 1", "Region", etc.) vêm de um arquivo JSON externo, sem necessidade de alterar código.

| Item | Valor |
|------|--------|
| Arquivo default | `rer-dsp-backend/src/main/resources/installationConfig.json` |
| Propriedade | `dsp.installation-config.file` |
| Variável de ambiente | `DSP_INSTALLATION_CONFIG_FILE` |

Formatos aceitos: `classpath:installationConfig.json` (default), `file:/etc/dsp/installationConfig.json`, ou caminho absoluto no disco.

O frontend consome `GET /config/installation` para montar filtros, títulos de tela e cards de KPI. A configuração é carregada uma vez e fica em cache na memória do backend — após mudar o arquivo, é necessário reiniciar a aplicação.

`screens.home.detail.fields` é a lista exclusiva da ficha da AOI (ordem preservada). Cada item tem `field` (nome da coluna no destino, ou chave `calculated.*`) e `label`. Lista vazia ou ausente: a API devolve `[]` e o detalhe devolve `attributes: {}` — a UI atual continua no DTO estrutural. Lista não vazia: o detalhe resolve `attributes` com exatamente essas chaves.

![Ficha da AOI com fallback do DTO estrutural](../assets/images/aoi-detail-fallback.png)

*Legenda: painel de detalhe da área de interesse quando `screens.home.detail.fields` está vazio ou ausente — a UI usa o DTO estrutural (`latitude`/`longitude`, território, data de alteração) em vez do mapa `attributes`.*

Chaves de `field`:

- Colunas da migração da AOI: `id`, `created_at`, `updated_at`, `area`, e extras de `persist_columns` (ex. `nome`, `latitude`).
- Calculados na aplicação (não são coluna): `calculated.latitude`, `calculated.longitude`, `calculated.territory_level_2_name`, `calculated.territory_level_3_name`.

`GET /totalizer/getDeatilsByIdentifier/{identifier}` e `GET /totalizer/getDetailsByCoordinates` devolvem o DTO estrutural (compatível com o front atual: `latitude`/`longitude` do centróide, `territory`, `alterationDate`, etc.) **e** o mapa `attributes`. A chave em `attributes` é a mesma de `fields[].field` (não camelCase). Datas em `attributes` usam `yyyy-MM-dd`. `otherIds` e o download não entram em `attributes`.

A coluna física de última alteração no `dsp-db` e no WFS é `updated_at`. O JSON estrutural do detalhe mantém `alterationDate`; em `attributes` a chave é `updated_at`.

Estrutura do JSON:

```json
{
  "hierarchy": [
    { "key": "level1", "label": "Level 1", "placeholder": "Select level 1", "order": 1 },
    { "key": "level2", "label": "Level 2", "placeholder": "Select level 2", "order": 2 },
    { "key": "level3", "label": "Level 3", "placeholder": "Select level 3", "order": 3 }
  ],
  "screens": {
    "home": { "...": "title, hierarchyKeys, identifier, detail, ..." },
    "downloads": { "...": "title, hierarchyKeys, theme, section titles, ..." }
  },
  "kpis": {
    "maxCards": 5,
    "primaryCode": "AREA_OF_INTEREST",
    "cards": [ { "code": "...", "label": "...", "unitOfMeasurement": "...", "accentColor": "...", "order": 1, "required": true } ]
  },
  "areaOfInterest": {
    "areaUnit": "ha",
    "areaUnitLabel": "ha"
  },
  "formats": {
    "date": "dd/MM/yyyy",
    "dateTime": "dd/MM/yyyy HH:mm:ss"
  },
  "map": {
    "initialView": {
      "mode": "territorial_bbox",
      "latitude": null,
      "longitude": null,
      "zoom": null
    }
  }
}
```

Exemplo com modo manual:

```json
"map": {
  "initialView": {
    "mode": "manual",
    "latitude": 39.5,
    "longitude": -8.0,
    "zoom": 7
  }
}
```

Exemplo com modo planet:

```json
"map": {
  "initialView": {
    "mode": "planet",
    "latitude": null,
    "longitude": null,
    "zoom": null
  }
}
```

| Bloco | Função |
|-------|--------|
| `hierarchy` | Labels e placeholders dos níveis `level1` / `level2` / `level3` — as **chaves** são estáveis (batem com `GET /territory/options?level=…`); altere o `label`, não a `key` |
| `screens.home` / `screens.downloads` | Quais níveis cada tela usa e textos dos campos. Em `screens.home.detail.fields`, a lista exclusiva da ficha da AOI (`field` + `label`) |
| `kpis` | Cards da home (rótulos, unidades, cores) |
| `map.initialView` | Modo de abertura/reset do mapa na Home. `mode` obrigatório: `territorial_bbox` (enquadra via `GET /territory/boundary-box`; se nenhum nível territorial L1/L2/L3 estiver configurado no ETL, o `./config.sh` grava `planet` explicitamente), `manual` (exige `latitude`, `longitude`, `zoom`) ou `planet` (sempre centro `[0,0]` zoom `0`) |
| `areaOfInterest` | Unidade/rótulo da área do imóvel — a área em si vem migrada da origem, o DSP não a calcula nem converte unidade |
| `formats` | Padrões de exibição de data/hora na UI |

Entre frontend e backend, datas trafegam sempre em `yyyy-MM-dd` (só dia) ou `yyyy-MM-dd'T'HH:mm:ss` (dia + hora); a UI converte para `formats.date`/`formats.dateTime` na exibição.

O que **não** entra neste arquivo: unidades territoriais (tabelas `dsp.territory_level_*` + job de migração), camadas WMS/GeoServer (`GET /map/getBaseMaps` e `GET /map/getLayers`), catálogo de downloads (`downloadThemesConfig.json`) e o mapeamento origem→destino do ETL (`application.yaml` do job de migração).

## Downloads (GeoServer Download WFS)

O catálogo de temas de download vem de `downloadThemesConfig.json`, gerado pelo `./config.sh` do core a partir de `area_of_interest` e `etl.layers[]`. O backend:

1. Valida território (nível 2 obrigatório, nível 3 opcional) no `dsp-db`.
2. Monta filtro CQL por tema.
3. Consulta o **GeoServer Download** via WFS (`GetFeature` com `resultType=hits` na busca; `outputFormat=csv` no download) em `DSP_GEOSERVER_WFS_BASE_URL`.
4. Para temas com feições no recorte, consulta `updated_at` via WFS (`sortBy`, `count=1`) e preenche `lastUpdate` na resposta (data de negócio).
5. Lê a metadata `generated-at` do objeto no storage (`HeadObject` do primeiro formato do tema) e preenche `lastFileGenerated`. O job grava esse instante no mesmo ISO UTC do CSV (`yyyy-MM-dd'T'HH:mm:ss'Z'`, exemplo `2026-09-10T16:55:19Z`), sem fração de segundo — não usa `Instant.toString()`. Sem objeto ou storage desligado, o campo fica `null`.
6. Devolve status ou bytes CSV ao frontend — o browser não acessa o GeoServer para arquivos de download.

Se `updated_at` faltar no WFS, a busca continua OK e `lastUpdate` fica `null` (UI exibe `—`). Sem `generated-at`, `lastFileGenerated` também fica `null` (UI exibe `—`). Arquivos já no bucket só passam a ter `generated-at` na próxima geração bem-sucedida.

O CSV de download usa data/hora em **UTC**, texto ISO 8601 `yyyy-MM-dd'T'HH:mm:ss'Z'` (exemplo `2026-08-18T18:43:48Z`), sem fração de segundo. O job grava nesse padrão; o GeoServer Download usa o mesmo `csvDateFormat` com `TZ=UTC`. O backend só encaminha os bytes — não reconverte a data. Arquivos já no storage só nascem no formato novo na próxima geração.

## Configuração da página About

O conteúdo institucional da página About pode ser configurado pelo adotante via arquivo de índice + Markdown, no mesmo padrão da configuração de instalação.

| Item | Valor |
|------|--------|
| Propriedade (índice) | `dsp.about-config.config-file`, default `file:../rer-dsp-core/config/about/about-config.json` |
| Propriedade (conteúdo) | `dsp.about-config.content-dir`, default `file:../rer-dsp-core/config/about/` |
| Variáveis de ambiente | `DSP_ABOUT_CONFIG_FILE`, `DSP_ABOUT_CONTENT_DIR` |

`AboutConfigService` lê o JSON de índice (`file:`/`classpath:`/caminho puro) e, para cada aba, lê o `.md` correspondente dentro de `contentDir`, montando a resposta; o resultado fica em cache. Se `enabled=false` no índice ou o arquivo de índice não existir, a resposta volta com `enabled=false` e `tabs` vazia — a aplicação não derruba por isso. JSON malformado ou `.md` referenciado ausente resultam em erro 500 (mesmo padrão do `InstallationConfigService`).

`GET /config/about` é exposto por `AboutController`/`AboutApi` e devolve `AboutConfigResponse` (`enabled`, `bannerTitle`, `tabs: [{ id, label, content }]`), onde `content` já é o Markdown lido do arquivo correspondente. A primeira aba da lista é a que abre por padrão no frontend.

## Integração com os demais módulos

- Depende do **core** para o schema `dsp` no Postgres e para os arquivos externos `installationConfig.json` e `mapLayersConfig.json`.
- É consumido pelo **frontend** via API REST (`VITE_DSP_API_URL`).
- Lê exclusivamente o banco **dsp-db** — nunca acessa `geoserver-db` diretamente.
- Consulta o **GeoServer Download** via HTTP/WFS para downloads de arquivo.

Veja também: [Bancos de dados](../architecture/databases.md), [Fluxo de dados](../architecture/data-flow.md).
