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
git clone https://github.com/Rural-Environmental-Registry/dsp-docs.git
cd dsp-docs
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

### 3. Subir a documentação localmente

Português (Brasil):

```bash
zensical serve -f zensical.pt-br.toml
```

English:

```bash
zensical serve -f zensical.en.toml
```

Abra no navegador: [http://localhost:8000](http://localhost:8000)

Opções úteis:

```bash
# Abrir o navegador automaticamente
zensical serve -f zensical.pt-br.toml --open

# Outra porta
zensical serve -f zensical.pt-br.toml --dev-addr localhost:8080
```

O `serve` reconstrói um idioma por vez e **não** inclui o outro locale na mesma URL — para alternar idioma no menu, prefira `./start-docs.sh` ou o build completo abaixo.

`zensical.toml` é equivalente a `zensical.pt-br.toml` (compatibilidade com `zensical serve` sem `-f`).

### 4. Gerar o site estático (opcional)

Build completo (raiz + os dois idiomas), como no CI:

```bash
rm -rf site && mkdir -p site
cp static/root/index.html site/index.html
zensical build -f zensical.pt-br.toml --clean
zensical build -f zensical.en.toml
```

A saída fica em `site/` (`index.html`, `pt-br/`, `en/`). Essa pasta não vai para o Git; o CI gera de novo no deploy.

Para testar o **seletor de idioma** localmente, use o build completo em `site/` (pastas `/pt-br/` e `/en/` na mesma origem). O script [`start-docs.sh`](start-docs.sh) faz isso e abre [http://127.0.0.1:8000/pt-br/](http://127.0.0.1:8000/pt-br/). No GitHub Pages, um script acrescenta o prefixo `/dsp-docs` aos links de idioma.

## Editar o conteúdo

1. Ative o ambiente: `source .venv/bin/activate`
2. Rode `zensical serve -f zensical.pt-br.toml` ou `zensical.en.toml`
3. Edite o Markdown em `docs/pt-br/` e/ou `docs/en/`
4. Ajuste a navegação no `zensical.pt-br.toml` ou `zensical.en.toml` correspondente

**Paridade de idiomas:** alterações de conteúdo em `docs/pt-br/` devem incluir a tradução equivalente em `docs/en/` na mesma mudança (mesmos caminhos de arquivo e estrutura de `nav`).

Ao alterar extensões Markdown, `features` ou tema, atualize **os dois** arquivos `zensical.*.toml` para manter o comportamento alinhado.

## Publicação

Antes do primeiro deploy, habilite o GitHub Pages **uma vez**:

1. No repositório: **Settings → Pages**
2. Em **Build and deployment → Source**, escolha **GitHub Actions**

Sem isso, o job `deploy` falha com `Get Pages site failed` / `Not Found`.

Depois, push em `main` dispara o workflow [Documentation](.github/workflows/docs.yml), que gera `site/` (redirect na raiz, `/pt-br/` e `/en/`) e publica no **GitHub Pages**. Se o primeiro run já falhou, reexecute o workflow em **Actions**.

## Licença

GPL-3.0 — Rural Environmental Registry
