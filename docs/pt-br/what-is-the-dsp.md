# O que é o DSP

## O que é o DSP?

O **DSP (Data Sharing Platform)** é uma plataforma de aplicabilidade **genérica** para sincronizar, publicar e compartilhar dados geoespaciais a partir de qualquer fonte JDBC — ela não exige um schema ou domínio de dados específico. Na prática, o DSP nasceu e é mantido como um **complemento ao ecossistema [RER](https://www.digitalpublicgoods.net/r/rural-environmental-registry-registration-module)** (*Rural Environmental Registry*, um bem público digital / DPG), e é nesse contexto que a documentação usa exemplos de dados ambientais rurais.

O objetivo é compartilhar dados geoespaciais de forma confiável, com base sincronizada a partir da fonte JDBC do adotante — no ecossistema [RER](https://www.digitalpublicgoods.net/r/rural-environmental-registry-registration-module), esses dados são tipicamente ambientais rurais, mas o mecanismo é o mesmo para qualquer outro domínio. A ideia do DSP surgiu após a consolidação da [consulta pública do CAR](https://consulta.car.gov.br/): generalizar essa experiência de consulta e compartilhamento no mapa para qualquer organização que já mantenha uma base geoespacial (por exemplo, um cadastro ambiental rural), sem consultar o banco de produção em tempo real.

## Qual problema ele resolve?

Organizações que possuem uma base de dados geoespacial (propriedades rurais, territórios, unidades administrativas) frequentemente enfrentam dois problemas ao tentar compartilhar esses dados:

1. **Expor a base de origem diretamente é arriscado** — schema interno, performance e segurança do banco de produção ficam vulneráveis a consultas externas.
2. **Construir do zero uma API + frontend + publicação de mapas é caro** e repetitivo — toda organização acaba resolvendo o mesmo problema de forma isolada.

O DSP resolve isso com um pipeline de sincronização (ETL) que lê da fonte do adotante e grava, de forma controlada, em dois bancos de destino próprios do DSP — um para a API, outro para os mapas — sem tocar diretamente na base de origem em tempo de consulta. Para alto volume de dados e territórios extensos (como o cadastro nacional do [SICAR](https://www.car.gov.br/) no Brasil), um job de pré-geração produz antecipadamente os arquivos de download mais pesados e armazena uma prévia pronta para entrega; assim a consulta pública permanece rápida mesmo com milhões de registros e exportações por município, estado ou país.

## Em quais cenários deve ser utilizado?

- A organização já mantém um banco PostgreSQL/PostGIS com dados de territórios, imóveis rurais ou unidades administrativas.
- Existe a necessidade de **compartilhar esses dados com parceiros externos ou com publico geral** via mapa web ou download de arquivos.
- A organização quer uma solução **pronta para orquestrar via Docker**, sem construir API, frontend e publicação de mapas do zero.

## Este sistema é útil para minha organização?

Provavelmente sim, se:

- [x] Você já tem uma fonte de dados geoespaciais (banco JDBC) com propriedades (ou outras áreas de interesse) ou territórios.
- [x] Você precisa compartilhar esses dados com terceiros ou com publico geral — não apenas uso interno.
- [X] Você não deseja utilizar o banco de dados de produção da sua aplicação para consultas externas, evitando sobrecarregá-lo, nem precisar desenvolver uma API, um frontend e toda a infraestrutura de publicação de mapas do zero.
- [x] Você tem capacidade de rodar Docker (Docker 24+ com Compose v2) na infraestrutura de destino.

Provavelmente não é o caso certo, se:

- [ ] Você não tem nenhuma base geoespacial estruturada para migrar — o DSP não cria dados, ele sincroniza e publica dados existentes.
- [ ] Sua necessidade é só uso interno, sem exposição via API, mapa ou download — nesse caso o esforço de operar 2 bancos + GeoServer + módulos pode não compensar.
- [ ] Você precisa de uma solução sem Docker (embora isso seja possível, exigirá alterações manuais nos módulos e um processo mais longo de compreensão do código) ou possui requisitos de infraestrutura significativamente diferentes dos documentados neste guia.

!!! tip "Próximo passo"
    Se o cenário faz sentido, veja os [módulos do DSP](dsp-modules.md) para entender as peças, ou vá direto para uma [demo local](guides/quick-start.md).
