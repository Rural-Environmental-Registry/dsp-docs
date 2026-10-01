> [!IMPORTANT]
> This README documents the **documentation module** only: how this site is built, edited, and published. It is not the DSP documentation.
>
> To learn about the DSP, open the link below.
>
> **[DSP documentation](https://rural-environmental-registry.github.io/dsp-docs)**
## High-level architecture

```mermaid
flowchart LR
  browser["BROWSER<br/>Public map consultation."]
  gw["GATEWAY<br/>nginx · single HTTP entry.<br/>/dsp/ · /dsp-backend/ · GeoServers."]

  srcDb[("YOUR DATABASE<br/>Your organization's DB to migrate from.<br/>Source for the DSP.")]
  jobMig["JOB-DATA-MIGRATION<br/>Spring Batch ETL.<br/>source → dsp-db + geoserver-db."]
  jobGeo["JOB-GEO-FILE-GENERATION<br/>Pre-generates download files.<br/>"]
  core["CORE<br/>CONFIG · SETUP · START.<br/>Prepares DBs and orchestrates modules."]

  dspDb[("DSP DB<br/>Operational: business + bbox/centroid.")]
  gsDb[("GEOSERVER DB<br/>Full geometry dsp.*<br/>Read by both GeoServers.")]
  objStor[("OBJECT STORAGE<br/>SeaweedFS S3.<br/>")]

  be["DSP BACKEND<br/>REST API and business rules."]
  fe["DSP FRONTEND<br/>Web platform UI.<br/>Consultation, maps, sharing."]

  gsEx["GEOSERVER-EXHIBITION<br/>Publishes layers for viewing.<br/>WMS/WFS map service."]
  gsDl["GEOSERVER-DOWNLOAD<br/>WFS for download export.<br/>Used by the backend."]

  browser --> gw
  gw -->|/dsp/| fe
  gw -->|/dsp-backend/| be
  gw -->|/geoserver-exhibition/| gsEx

  jobMig -->|read| srcDb
  jobMig -->|"business + bbox/centroid"| dspDb
  jobMig -->|"full geom"| gsDb
  core -.config/schema/build.-> jobMig
  core -.-> jobGeo
  core -.-> dspDb
  core -.-> gsDb
  core -.-> objStor
  core -.-> gw
  core -.-> be
  core -.-> fe
  core -.-> gsEx
  core -.-> gsDl

  dspDb --> be
  gsDb --> gsEx
  gsDb --> gsDl
  gsDb --> jobGeo
  jobGeo -->|"pre-generated CSV"| objStor
  be -->|WFS downloads| gsDl
  be -->|CSV when available| objStor

  classDef app fill:#0f766e22,color:#115e59,stroke:#0f766e,stroke-width:2px
  classDef geoCls fill:#16653422,color:#14532d,stroke:#166534,stroke-width:2px
  classDef db fill:#b4530922,color:#92400e,stroke:#b45309,stroke-width:2px
  classDef job fill:#7c2d1222,color:#7c2d12,stroke:#9a3412,stroke-width:2px
  classDef coreCls fill:#312e8122,color:#312e81,stroke:#4338ca,stroke-width:2px
  classDef entryCls fill:#1e3a5f22,color:#1e3a5f,stroke:#2563eb,stroke-width:2px
  classDef storageCls fill:#4c1d9522,color:#4c1d95,stroke:#7c3aed,stroke-width:2px

  class fe,be app
  class gsEx,gsDl geoCls
  class dspDb,gsDb,srcDb db
  class jobMig,jobGeo job
  class core coreCls
  class browser,gw entryCls
  class objStor storageCls
```

## This module

Wiki site for the DSP documentation, published in Portuguese (Brazil) and English. The site root redirects by browser language (`pt*` to `/pt-br/`, `en*` and any other language to `/en/`), with manual links when JavaScript is disabled.

| Language | Path |
|---|---|
| Portuguese (Brazil) | `/pt-br/` |
| English | `/en/` |

### Prerequisites

- Python 3
- pip

### How to run

```bash
git clone https://github.com/Rural-Environmental-Registry/dsp-docs.git
cd dsp-docs
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

No Windows (PowerShell):

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Gere o site e sirva a pasta `site/`:

```bash
./scripts/build-site.sh
cd site
python3 -m http.server 8000 --bind 127.0.0.1
```

Abra [http://127.0.0.1:8000/pt-br/](http://127.0.0.1:8000/pt-br/). Para parar, encerre o processo no terminal.

Não rode `zensical build -f zensical.pt-br.toml` direto nos TOMLs fonte. O `site_url` usa o placeholder `__DOCS_PAGES_BASE__` e o HTML sai quebrado. O `build-site.sh` e o CI passam por `scripts/resolve-zensical-config.sh`.

Live reload de um idioma, sem o seletor de idioma:

```bash
./scripts/serve-one-locale.sh pt-br
# ou
./scripts/serve-one-locale.sh en --open
```

Abra [http://127.0.0.1:8000](http://127.0.0.1:8000). O conteúdo fica na raiz, sem o prefixo `/pt-br/`.

`zensical.toml` equivale a `zensical.pt-br.toml`.

### Editing

1. Ative o ambiente: `source .venv/bin/activate`
2. Rode `./scripts/serve-one-locale.sh pt-br` (live reload) ou `./scripts/build-site.sh` e sirva a pasta `site/`
3. Edite o Markdown em `docs/pt-br/` e/ou `docs/en/`
4. Ajuste a navegação no `zensical.pt-br.toml` ou `zensical.en.toml` correspondente

GPL-3.0 — Rural Environmental Registry

<small><strong>Copyright © 2026 Government of Brazil — Ministry of Management and Innovation in Public Services</strong></small>
