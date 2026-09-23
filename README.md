# [RER](https://www.digitalpublicgoods.net/r/rural-environmental-registry-registration-module) DSP — Documentação

Wiki da **Data Sharing Platform (DSP)** do ecossistema [**RER**](https://www.digitalpublicgoods.net/r/rural-environmental-registry-registration-module). Fonte de verdade para onboarding, arquitetura e padrões dos repositórios do DSP.

A documentação é publicada em **português (Brasil)** e **inglês (en-US)**:

| Idioma | Caminho no site |
|--------|-----------------|
| Português (Brasil) | `/pt-br/` |
| English | `/en/` |

A raiz (`/`) redireciona conforme o idioma do navegador (`pt*` → pt-BR; `en*` → inglês; demais → inglês), com links manuais se o JavaScript estiver desativado.

## Pré-requisitos

- Python 3
- pip

## Como executar

### 1. Clonar e entrar no repositório

```bash
git clone https://github.com/Rural-Environmental-Registry/rer-dsp-docs.git
cd rer-dsp-docs
```

### 2. Criar o ambiente e instalar dependências

```bash
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

### 3. Subir a documentação localmente (pt-br + en)

Use o script que faz o build completo e serve a pasta `site/` (igual ao GitHub Pages):

```bash
chmod +x start-docs.sh scripts/build-site.sh
./start-docs.sh
```

Abra: [http://127.0.0.1:8000/pt-br/](http://127.0.0.1:8000/pt-br/) (troca de idioma no menu → `/en/`).

Para **parar** o servidor:

```bash
./start-docs.sh --stop
```

**Importante:** não use `zensical build -f zensical.pt-br.toml` direto nos TOMLs fonte — o `site_url` usa o placeholder `__DOCS_PAGES_BASE__` e o HTML sai quebrado. O `build-site.sh` (e o CI) passam por `scripts/resolve-zensical-config.sh`.

### 4. Edição com live reload (um idioma)

Sem troca de idioma no menu (só o locale escolhido):

```bash
./scripts/serve-one-locale.sh pt-br
# ou
./scripts/serve-one-locale.sh en --open
```

Abra [http://127.0.0.1:8000](http://127.0.0.1:8000) — o conteúdo fica na raiz do servidor, **sem** prefixo `/pt-br/`.

### 5. Gerar o site estático (opcional)

```bash
./scripts/build-site.sh
```

A saída fica em `site/` (`index.html`, `pt-br/`, `en/`). Essa pasta não vai para o Git; o CI gera de novo no deploy.

`zensical.toml` é equivalente a `zensical.pt-br.toml` (compatibilidade com `zensical serve` sem `-f`, se resolver o config antes).

## Editar o conteúdo

1. Ative o ambiente: `source .venv/bin/activate`
2. Rode `./start-docs.sh` (dois idiomas) ou `./scripts/serve-one-locale.sh pt-br` (live reload)
3. Edite o Markdown em `docs/pt-br/` e/ou `docs/en/`
4. Ajuste a navegação no `zensical.pt-br.toml` ou `zensical.en.toml` correspondente

**Paridade de idiomas:** alterações de conteúdo em `docs/pt-br/` devem incluir a tradução equivalente em `docs/en/` na mesma mudança (mesmos caminhos de arquivo e estrutura de `nav`).

Ao alterar extensões Markdown, `features` ou tema, atualize **os dois** arquivos `zensical.*.toml` para manter o comportamento alinhado.

O seletor de idioma e a página raiz montam URLs no navegador a partir do **path atual** (`origin` + tudo antes de `/pt-br/` ou `/en/`), sem nome fixo de repositório — funciona em qualquer fork (`https://usuario.github.io/outro-nome/pt-br/`, etc.).

No CI, `site_url` (canonical/SEO) é resolvido automaticamente com `GITHUB_REPOSITORY` (`https://<owner>.github.io/<repo>/...`). Domínio customizado: defina `DOCS_PAGES_BASE` no workflow. Localmente: `scripts/resolve-zensical-config.sh` usa `http://127.0.0.1:8000` por padrão.

## Publicação

Antes do primeiro deploy, habilite o GitHub Pages **uma vez**:

1. No repositório: **Settings → Pages**
2. Em **Build and deployment → Source**, escolha **GitHub Actions**

Sem isso, o job `deploy` falha com `Get Pages site failed` / `Not Found`.

Depois, push em `main` dispara o workflow [Documentation](.github/workflows/docs.yml), que gera `site/` (redirect na raiz, `/pt-br/` e `/en/`) e publica no **GitHub Pages**. Se o primeiro run já falhou, reexecute o workflow em **Actions**.

## Licença

GPL-3.0 — Rural Environmental Registry
