# Data

## `english_education.csv`

**Educational attainment of young people in English towns data**
Office for National Statistics, released 25 July 2023.

- Dataset: <https://www.ons.gov.uk/peoplepopulationandcommunity/educationandchildcare/datasets/educationalattainmentofyoungpeopleinenglishtownsdata>
- Accompanying analysis: [*Why do children and young people in smaller towns do
  better academically than those in larger towns?*](https://www.ons.gov.uk/peoplepopulationandcommunity/educationandchildcare/articles/whydochildrenandyoungpeopleinsmallertownsdobetteracademicallythanthoseinlargertowns/2023-07-25)

1,104 English towns, 31 columns. Built from the Department for Education's
Longitudinal Educational Outcomes database, following pupils who sat GCSEs in
English state schools in the 2012/13 school year from age 11 to age 22, joined
to the 2011 Census built-up-area geography of where they lived at GCSE.

### Licence

Open Government Licence v3.0. The ONS states: *"All content is available under
the Open Government Licence v3.0, except where otherwise stated."*

The OGL permits copying, redistribution and adaptation, including commercially,
provided the source is acknowledged. Full terms:
<https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/>

> Contains public sector information licensed under the Open Government Licence
> v3.0.

The file is redistributed here **unmodified**; all filtering and derived columns
happen in the notebooks, so what is in the repo is what the ONS published.

### Columns used

| Column | Meaning |
|---|---|
| `education_score` | standardised composite of attainment and post-16 destinations; 0 is the all-areas average, higher is better |
| `size_flag` | Small / Medium / Large Towns, plus City and London categories that the analysis drops |
| `income_flag` | deprivation band: higher / mid / lower deprivation towns |
| `rgn11nm` | region name (2011 geography), 8 levels among towns |
| `coastal` | coastal or non-coastal |
| `town11nm`, `population_2011` | identifiers and size, not used in the model |

The remaining 25 columns are the component attainment measures that feed
`education_score` (key stage 2 and 4 results, level 2/3 at 18, age-19
destinations). They are deliberately unused: they are constituents of the
outcome, so conditioning on them would be conditioning on the outcome itself.

### A note on the unit of analysis

Every row is a **town**, and every variable is a town-level aggregate. Findings
are about towns, not pupils. Reading them as statements about individual
children is the [ecological fallacy](https://en.wikipedia.org/wiki/Ecological_fallacy).
