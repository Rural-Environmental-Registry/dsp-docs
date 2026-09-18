# What is the DSP

## What is the DSP?

The **DSP (Data Sharing Platform)** is a **generic** platform for synchronizing, publishing, and sharing geospatial data from any JDBC source—it does not require a specific schema or data domain. In practice, the DSP was created and is maintained as a **complement to the [RER](https://www.digitalpublicgoods.net/r/rural-environmental-registry-registration-module)** ecosystem (*Rural Environmental Registry*, a digital public good / DPG), and that is the context in which this documentation uses rural environmental data examples.

The goal is to share geospatial data reliably, with a synchronized copy from the adopter’s JDBC source—in the [RER](https://www.digitalpublicgoods.net/r/rural-environmental-registry-registration-module) ecosystem that data is typically rural environmental information, but the same mechanism applies to any other domain. The DSP idea emerged after the [Brazilian CAR public consultation](https://consulta.car.gov.br/) matured: generalize that map-based consultation and sharing experience for any organization that already maintains a geospatial database (for example, a rural environmental registry), without querying the production database in real time.

## What problem does it solve?

Organizations with a geospatial database (rural properties, territories, administrative units) often face two problems when trying to share that data:

1. **Exposing the source database directly is risky**—internal schema, performance, and production database security are exposed to external queries.
2. **Building an API + frontend + map publication stack from scratch is expensive** and repetitive—every organization solves the same problem in isolation.

The DSP addresses this with a synchronization pipeline (ETL) that reads from the adopter’s source and writes in a controlled way to two DSP-owned target databases—one for the API, one for maps—without touching the source database at query time. For high data volume and large territories (such as Brazil’s national [SICAR](https://www.car.gov.br/) registry), a pre-generation job produces the heaviest download files ahead of time and stores a ready preview for delivery; public consultation stays fast even with millions of records and exports by municipality, state, or country.

## When should it be used?

- The organization already runs PostgreSQL/PostGIS with territory, rural property, or administrative unit data.
- There is a need to **share that data with external partners or the general public** via a web map or file downloads.
- The organization wants a solution **ready to orchestrate with Docker**, without building API, frontend, and map publication from scratch.

## Is this system a good fit for my organization?

Probably yes, if:

- [x] You already have a geospatial data source (JDBC database) with properties (or other areas of interest) or territories.
- [x] You need to share that data with third parties or the general public—not only for internal use.
- [x] You do not want to use your application’s production database for external queries (avoiding overload) and do not want to build an API, frontend, and full map infrastructure from scratch.
- [x] You can run Docker (Docker 24+ with Compose v2) on the target infrastructure.

Probably not, if:

- [ ] You have no structured geospatial base to migrate—the DSP does not create data; it synchronizes and publishes existing data.
- [ ] Your need is internal only, with no exposure via API, map, or download—in that case operating 2 databases + GeoServer + modules may not be worth it.
- [ ] You need a solution without Docker (possible, but requires manual changes across modules and a longer path to understand the code) or infrastructure requirements that differ significantly from what this guide documents.

!!! tip "Next step"
    If the scenario fits, see [DSP modules](dsp-modules.md) to understand the pieces, or go straight to a [local demo](guides/quick-start.md).
