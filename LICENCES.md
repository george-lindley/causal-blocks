# Dataset licences

An audit of the real datasets behind the Worksheets (`site/js/datasets/<key>.js`, data in
`site/data/samples/<key>.csv`) and the game levels built on them. Every one came through
[TidyTuesday](https://github.com/rfordatascience/tidytuesday), whose repo is CC0 — but that covers
TidyTuesday's own files, not the data: **each dataset keeps its original source's terms.** Each
licence below was read at the original source on 13 October 2026; nothing is assumed. Where no
licence is stated, the table says so.

This is a record of what the sources say, not legal advice. Re-check before charging for anything.

## Summary

| Group | Meaning | Datasets |
|---|---|---|
| 🟢 **GREEN** | CC0 / public domain: use freely, credit as a courtesy | penguins, cats, chess |
| 🟠 **AMBER** | Attribution required (CC BY, OGL, MIT): fine if credited as below | tortoises, towns, beaches, snowman, pokemon* |
| 🔴 **RED** | No stated licence, non-commercial, or terms that forbid reuse | mariokart, chocolate, coffee, cappuccino |
| ⛔ **REMOVED** | Terms forbid redistribution: taken off the site on 13 October 2026 | himalaya, ultra |

\* Pokémon: the data is MIT-licensed, but "Pokémon" and the creatures' names are trademarks of
Nintendo / Creatures / Game Freak. Using the name in a paid game is a trademark question, separate
from the data licence.

**Removed:** the Himalayan Database ("You may not give or distribute the Himalayan Database, or any
of its … data … to any other person or entity") and ITRA ("Sharing, selling, or redistributing ITRA
data to third parties" is forbidden) were taken off the site on 13 October 2026, along with their
hosted CSVs. Their rows stay below as the record of why. Their files were also removed from this
repo's git history.

**Publishing data (policy changed 16 October 2026).** Data may be published where its licence allows
redistribution: 🟢 GREEN and 🟠 AMBER datasets, with their required credit next to the data, saying what
was changed ("adapted: rows filtered, columns renamed"). The game's levels serve their rows this way
(e.g. Heavy Pokémon's `rows.json`, MIT; the towns lab level's, OGL). 🔴 RED datasets stay results-only:
answers worked out in advance from private CSVs, charts of averages, and a link to the source. ⛔
REMOVED datasets are not used at all. The worksheets on this site still publish results only
(`scripts/precompute_worksheets.mjs`, results in `site/data/worksheets/<key>.json`), and
`tests/js/datasets_harness.mjs` still rejects a published CSV here. That's this site's choice, not a
licence requirement. Before 16 October 2026 the rule was that no dataset was published anywhere.

**Credits:** every dataset config (`site/js/datasets/<key>.js`) carries `credit`, `origin` (the original
source's URL) and `licence` (`name`, `url`, `group`). Each worksheet shows "Data: credit, licence, via
TidyTuesday". `tests/js/datasets_harness.mjs` rejects a dataset without these fields, a missing
precomputed result, or a published CSV.

## The table

| Dataset (config) | TidyTuesday week | Original source | Licence | Commercial use | Required credit wording | Where the licence was found |
|---|---|---|---|---|---|---|
| 🟢 **penguins** (`penguins.js`) | [2020-07-28](https://github.com/rfordatascience/tidytuesday/tree/main/data/2020/2020-07-28) | palmerpenguins R package — Gorman, Williams & Fraser, Palmer Station LTER ([github.com/allisonhorst/palmerpenguins](https://github.com/allisonhorst/palmerpenguins)) | CC0 1.0 | yes | none required; courtesy: "palmerpenguins (Gorman, Williams & Fraser), CC0" | repo licence (GitHub API: `CC0-1.0`) — https://github.com/allisonhorst/palmerpenguins |
| 🟢 **cats** (`cats.js`) | [2023-01-31](https://github.com/rfordatascience/tidytuesday/tree/main/data/2023/2023-01-31) | Movebank Data Repository — Kays et al., *Pet cats United Kingdom* ([doi:10.5441/001/1.pf315732](https://doi.org/10.5441/001/1.pf315732)) | CC0 1.0 | yes | none required; courtesy: "Kays et al. (2020), Pet cats UK, Movebank, CC0" | DataCite record for the DOI (`rightsList: CC0 1.0 Universal`) — https://api.datacite.org/dois/10.5441/001/1.pf315732 |
| 🟢 **chess** (`chess.js`) | [2024-10-01](https://github.com/rfordatascience/tidytuesday/tree/main/data/2024/2024-10-01) | Kaggle *Chess Game Dataset (Lichess)* by Mitchell J ([kaggle.com/datasets/datasnaek/chess](https://www.kaggle.com/datasets/datasnaek/chess)); games from Lichess | CC0 (Kaggle: "CC0: Public Domain"); Lichess database exports are also CC0 | yes | none required; courtesy: "Lichess games via Kaggle (Mitchell J), CC0" | Kaggle API (`licenseName: CC0: Public Domain`) — https://www.kaggle.com/api/v1/datasets/view/datasnaek/chess ; Lichess: "Database exports are released under the Creative Commons CC0 license" — https://database.lichess.org/ |
| 🟠 **tortoises** (`tortoises.js`) | [2026-03-03](https://github.com/rfordatascience/tidytuesday/tree/main/data/2026/2026-03-03) | Arsovski, Bonnet, Golubović & Tomović, supplement to *Ecology Letters* (2026) on figshare ([doi:10.6084/m9.figshare.30752687.v1](https://doi.org/10.6084/m9.figshare.30752687.v1)) | CC BY 4.0 | yes with attribution | "Arsovski et al., Ecology Letters (2026), CC BY 4.0" + link to the licence | DataCite record (`rightsList: Creative Commons Attribution 4.0 International`) — https://api.datacite.org/dois/10.6084/m9.figshare.30752687.v1 |
| 🟠 **towns** (`towns.js`) | [2024-01-23](https://github.com/rfordatascience/tidytuesday/tree/main/data/2024/2024-01-23) | Office for National Statistics, *Educational attainment of young people in English towns* ([ons.gov.uk](https://www.ons.gov.uk/peoplepopulationandcommunity/educationandchildcare/datasets/educationalattainmentofyoungpeopleinenglishtownsdata)) | Open Government Licence v3.0 | yes with attribution | "Contains public sector information licensed under the Open Government Licence v3.0." (already in `data/README.md`) | ONS: "All content is available under the Open Government Licence v3.0, except where otherwise stated" — https://www.ons.gov.uk/help/termsandconditions |
| 🟠 **beaches** (`beaches.js`) | [2025-05-20](https://github.com/rfordatascience/tidytuesday/tree/main/data/2025/2025-05-20) | Beachwatch, NSW Government ([beachwatch.nsw.gov.au](https://www.beachwatch.nsw.gov.au/waterMonitoring/waterQualityData)); weather from Open-Meteo ([open-meteo.com](https://open-meteo.com/)) | Beachwatch: Creative Commons Attribution (data.nsw.gov.au; data.gov.au lists CC BY 3.0 AU). Open-Meteo: CC BY 4.0 | yes with attribution | "Beachwatch water quality, NSW Government, CC BY" and "Weather data by Open-Meteo.com" (linked to open-meteo.com) | data.nsw.gov.au API (`license_title: Creative Commons Attribution`) — https://data.nsw.gov.au/data/api/3/action/package_show?id=beachwatch ; data.gov.au (`CC BY 3.0 AU`) — https://data.gov.au/data/dataset/nsw-beachwatch ; Open-Meteo — https://open-meteo.com/en/licence |
| 🟠 **snowman** (`snowman.js`) | [2025-12-02](https://github.com/rfordatascience/tidytuesday/tree/main/data/2025/2025-12-02) | Böögg burn times: Philip Shemella, *Sechselaeuten-data* ([github.com/philshem/Sechselaeuten-data](https://github.com/philshem/Sechselaeuten-data)), compiled from NZZ and German Wikipedia. Weather: MeteoSwiss open data ([data.geo.admin.ch](https://data.geo.admin.ch/ch.meteoschweiz.ogd-smn/sma/ogd-smn_sma_m.csv)) | Burn times: MIT (the repo). Weather: CC BY 4.0 | yes with attribution (see caveat) | "Böögg burn times: Sechselaeuten-data (Philip Shemella), MIT" and "Source: MeteoSwiss" | repo licence (GitHub API: `MIT`) — https://github.com/philshem/Sechselaeuten-data ; MeteoSwiss terms ("Source: MeteoSwiss", commercial use allowed) — https://opendatadocs.meteoswiss.ch/general/terms-of-use . Caveat: the repo says its burn times come from NZZ and German Wikipedia; Wikipedia text is CC BY-SA, NZZ's terms were not checked |
| 🟠 **pokemon** (`pokemon.js`; game Level 2) | [2025-04-01](https://github.com/rfordatascience/tidytuesday/tree/main/data/2025/2025-04-01) | {pokemon} R package by William Amorim ([CRAN](https://cran.r-project.org/package=pokemon), [GitHub](https://github.com/williamorim/pokemon)); stats originate from PokéAPI (BSD-3-Clause) | MIT ("MIT + file LICENSE", copyright "pokemon authors") | **unclear**: the data is yes with attribution; the Pokémon name and creatures are third-party trademarks | "{pokemon} R package (William Amorim), MIT" | CRAN License field "MIT + file LICENSE" — https://cran.r-project.org/package=pokemon ; package LICENSE (`COPYRIGHT HOLDER: pokemon authors`) — https://github.com/williamorim/pokemon ; PokéAPI repo licence BSD-3-Clause — https://github.com/PokeAPI/api-data |
| ⛔ **himalaya** (removed) | [2020-09-22](https://github.com/rfordatascience/tidytuesday/tree/main/data/2020/2020-09-22) | The Himalayan Database ([himalayandatabase.com](https://www.himalayandatabase.com/)) | Proprietary licence: all rights reserved; no redistribution; publishing extracts or analyses needs written consent | **no** (not without written consent) | n/a until permission is granted | *Himalayan Database Program Guide*, "Software License and Terms of Use": "You may not give or distribute the Himalayan Database, or any of its accompanying software, files, data … to any other person or entity" and "Unless and until you receive consent … you shall not be permitted to use any extracts, reports or analyses" — https://www.himalayandatabase.com/downloads/Himalayan%20Database%20Guide.pdf |
| ⛔ **ultra** (removed) | [2021-10-26](https://github.com/rfordatascience/tidytuesday/tree/main/data/2021/2021-10-26) | International Trail Running Association results ([itra.run](https://itra.run/Races/FindRaceResults)), scraped by Benjamin Nowak ([github.com/BjnNowak/UltraTrailRunning](https://github.com/BjnNowak/UltraTrailRunning), no licence file) | ITRA terms: personal, non-commercial use only; redistribution and automated extraction forbidden | **no** | n/a | ITRA General Conditions, Art. 5: "Publication of ITRA data without the express written consent of ITRA for business purposes … is prohibited"; forbidden: "Using automated tools, bots, or scripts to extract or collect data" and "Sharing, selling, or redistributing ITRA data to third parties" — https://itra.run/info/generalconditions ; Nowak repo has no licence (GitHub API) |
| 🔴 **mariokart** (`mariokart.js`) | [2021-05-25](https://github.com/rfordatascience/tidytuesday/tree/main/data/2021/2021-05-25) | Mario Kart World Records, fan site ([mkwrs.com](https://mkwrs.com/)) | not stated | **unclear** (no licence; collected from a fan site) | n/a | none found on https://mkwrs.com/ , https://mkwrs.com/about.php or https://mkwrs.com/data/ |
| 🔴 **chocolate** (`chocolate.js`) | [2022-01-18](https://github.com/rfordatascience/tidytuesday/tree/main/data/2022/2022-01-18) | Flavors of Cacao, Brady Brelinski ([flavorsofcacao.com](http://flavorsofcacao.com/chocolate_database.html)) | not stated; copyright notice only ("FoC Content by: Brady Brelinski © 2011-2026") | **unclear** (all rights reserved by default) | n/a | http://flavorsofcacao.com/chocolate_database.html (copyright line, no licence or terms) |
| 🔴 **coffee** (`coffee.js`) | [2020-07-07](https://github.com/rfordatascience/tidytuesday/tree/main/data/2020/2020-07-07) | Coffee Quality Institute database ([database.coffeeinstitute.org](https://database.coffeeinstitute.org/)), scraped by James LeDoux ([github.com/jldbc/coffee-quality-database](https://github.com/jldbc/coffee-quality-database), MIT for the repo) | not stated by CQI; the repo's MIT licence covers LeDoux's code and files, not CQI's data | **unclear** (scraped; CQI states no licence and asserts copyright in its documents) | n/a | GitHub API (`MIT`) for the repo; no terms of use found for the CQI database on database.coffeeinstitute.org |
| 🔴 **cappuccino** (`cappuccino.js`) | [2026-09-08](https://github.com/rfordatascience/tidytuesday/tree/main/data/2026/2026-09-08) | James Hoffmann's Cappuccino Index: a public Google Sheet shared with his video ([youtube.com/watch?v=WtlE3BW9Nqs](https://www.youtube.com/watch?v=WtlE3BW9Nqs)) | not stated (TidyTuesday: "James Hoffmann encouraged us to explore the figures ourselves and shared the full dataset in a public google sheet") | **unclear** (encouraged to explore, but no licence to reuse or republish) | n/a | TidyTuesday 2026-09-08 cleaning script comment — https://github.com/rfordatascience/tidytuesday/tree/main/data/2026/2026-09-08 ; no licence on the sheet |

## Notes

- **Where the data lives:** for the worksheets, only on the author's machine (`dailycode/worksheet-data/` and the raw
  TidyTuesday files in `dailycode/case-studies/<key>/`). This site publishes worked-out results only.
- **Attribution for AMBER sets** must sit next to the data where it's shown or downloaded, and say
  what was changed (we filter rows and rename columns): e.g. "adapted: rows filtered, columns
  renamed".
- **RED datasets** (no stated licence) are still analysed in worksheets, with results and averages
  only, and a link to the source. Before charging for anything built on them, ask the source for
  permission or replace them with an open dataset.
