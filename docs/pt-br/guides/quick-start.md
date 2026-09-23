# Começando rápido (demo local)

## Como testar o sistema rapidamente?

Este guia é **só para ver o DSP funcionando** na sua máquina: sobe uma demo local com seed sintético do Brasil (dados de exemplo no mapa), sem conectar nenhum banco da sua organização. Você navega no site, explora filtros, KPIs e o mapa — é o caminho mais rápido para **conhecer a interface**, não para publicar ou migrar dados reais.

!!! warning "Instalação com dados reais"
    Para **instalar e configurar com dados reais**, use o guia [Instalação completa](full-installation.md).

## Pré-requisito

| Ferramenta | Versão             |
|------------|--------------------|
| Git        | se os repositórios irmãos ainda não estiverem clonados |
| Docker     | 24+ com Compose v2 |
| Python     | 3                  |

O `rer-dsp-core` orquestra o build dos demais módulos via Docker. Se faltar algum repositório irmão, os scripts oferecem clonar automaticamente

## Passo 1 — Organizar os repositórios

O DSP é dividido em **repositórios irmãos** no GitHub. Recomendamos criar uma pasta `rer-dsp` e clonar tudo **no mesmo nível** — o `rer-dsp-core` espera os outros módulos em `../rer-dsp-backend`, `../rer-dsp-frontend`, etc.

#### Opção A — fluxo mais simples (recomendado)

Crie a pasta, clone só o core e entre nele. Os scripts `./config.sh`, `./setup.sh` e `./start.sh` detectam repositórios irmãos ausentes e oferecem cloná-los automaticamente ao lado do core:

```bash
mkdir rer-dsp && cd rer-dsp
git clone https://github.com/Rural-Environmental-Registry/rer-dsp-core.git
cd rer-dsp-core
```

Depois que você aceitar o clone automático nos scripts, a árvore típica fica assim:

```text
rer-dsp/
├── rer-dsp-core/          ← você trabalha aqui (config.sh, setup.sh, start.sh)
├── rer-dsp-backend/
├── rer-dsp-frontend/
├── rer-dsp-job-data-migration/
└── rer-dsp-job-geo-file-generation/
```

#### Opção B — clone manual

Clone todos os repositórios de aplicação como pastas irmãs dentro de `rer-dsp`:

```bash
mkdir rer-dsp && cd rer-dsp
git clone https://github.com/Rural-Environmental-Registry/rer-dsp-core.git
git clone https://github.com/Rural-Environmental-Registry/rer-dsp-backend.git
git clone https://github.com/Rural-Environmental-Registry/rer-dsp-frontend.git
git clone https://github.com/Rural-Environmental-Registry/rer-dsp-job-data-migration.git
git clone https://github.com/Rural-Environmental-Registry/rer-dsp-job-geo-file-generation.git
```

Resultado:

```text
rer-dsp/
├── rer-dsp-core/
├── rer-dsp-backend/
├── rer-dsp-frontend/
├── rer-dsp-job-data-migration/
└── rer-dsp-job-geo-file-generation/
```

## Passo 2 — Entrar no core

Se você ainda não estiver dentro do core:

```bash
cd rer-dsp/rer-dsp-core
```

Os scripts do core criam o `.env` na primeira vez que você rodar o setup — não precisa criar esse arquivo manualmente.

## Passo 3 — Rodar o setup em modo demo

```bash
./setup.sh
```

No menu **Step 3/11 — Setup mode**, escolha `1` — o texto exibido pelo script é:

```text
  1) Demonstration (built-in Brazil seed, no JDBC)
     Loads demo map data from built-in SQL — no source database or migration job.
     Use when exploring the UI, evaluating the stack, or when you do not have adopter data yet.
```

Isso prepara os bancos locais (`dsp-db`, `dsp-geoserver-db`), publica as camadas nos GeoServers (Exhibition + Download) e aplica o seed de demonstração. **Não** conecta ao banco de origem da sua organização (nenhuma fonte JDBC externa) e **não** sobe o job de migração — os dados vêm só do SQL de exemplo embutido no core.

Aguarde o `./setup.sh` **terminar por completo** (todas as etapas até o fim, com mensagem de sucesso no terminal). Só então passe ao Passo 4 — interromper no meio deixa bancos ou GeoServer incompletos.

## Passo 4 — Subir os demais componentes

```bash
./start.sh
```

O `./setup.sh` já deixou prontos bancos, GeoServers e dados de demo. O `./start.sh` sobe o restante da stack — **API (backend)**, **site (frontend)** e **gateway nginx** (porta única de acesso) — usando o que já está nos bancos. Ele **não** roda de novo o seed nem o job de migração; serve para ligar a interface e a API depois que a base geográfica já foi carregada.

Espere o `./start.sh` concluir antes de abrir o navegador.

## Passo 5 — Acessar o sistema

Com o `./start.sh` finalizado e os containers no ar, abra no navegador **http://localhost:8026/dsp/** (ou a URL exibida no passo 5 do `./start.sh` se você alterou porta/host no `.env`):

![Consulta pública do DSP — demo local após o start](../assets/images/dsp-home.png)

*Legenda: mesma tela da consulta pública, rodando localmente depois do `./start.sh` (gateway na porta configurada, em geral `http://localhost:8026/dsp/`).*

## Próximos passos

| Quero... | Página |
|----------|--------|
| Entender a arquitetura completa | [Arquitetura — Visão geral](../architecture/overview.md) |
| Instalar com dados reais de uma organização | [Instalação completa](full-installation.md) |
| Detalhar o job de migração | [rer-dsp-job-data-migration — Visão geral](../modules/job-data-migration/overview.md) |
| Entender pré-geração de downloads (adotante real) | [rer-dsp-job-geo-file-generation](../modules/job-geo-file-generation/overview.md) |
