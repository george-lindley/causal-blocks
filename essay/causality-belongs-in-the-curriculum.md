# My analytics degree taught me to control for everything. That's how you get the answer backwards.

England's smaller towns produce better educational outcomes than its larger
ones. The Office for National Statistics published an analysis in 2023 with that
finding in the title, and the data backs it: across 1,082 English towns, small
towns average +0.30 on a standardised attainment score and large towns −0.81.

I spent a while with that dataset, and the number that stopped me was not the
gap. It was what happened to the gap when I accounted for deprivation.

It reversed.

| Large vs small towns | Effect | p |
|---|---|---|
| Total effect (adjusting for region) | **−1.28** points | 0.001 |
| ↳ the part flowing through deprivation | −1.99 points | |
| Direct effect (deprivation held fixed) | **+0.70** points | 0.022 |

Not "shrank toward zero." Not "lost significance." Compare towns at the same
level of deprivation and the *large* ones come out ahead.

The mechanism is not subtle once you look. 32% of small towns fall in the
higher-deprivation band, against 69% of large towns. And the deprivation gap in
attainment — 5.18 points, 1.43 standard deviations — is about four times larger
than the biggest town-size gap. Town size is a proxy for wealth, and the
headline is mostly measuring wealth while pointing at geography.

Both numbers in that table are correct. They answer different questions. The
whole difficulty is that nothing in a regression output tells you which question
you asked.

---

## The heuristic I was taught

I have a Masters in Business Analytics. It was a good degree; I use it. It
covered regression properly, then regularisation, cross-validation,
tree ensembles, standard errors, the bootstrap. Estimation in real depth.

Somewhere in there I absorbed a rule that was never stated outright but was
implied by every assignment: **when in doubt, control for more things.** Put the
covariates in. Watch adjusted R² rise. More controls means fewer lurking
variables, means a more defensible estimate. Rigour, operationalised as column
count.

That rule is not merely incomplete. It is wrong in two separate ways, and the
second one is genuinely alarming.

## Wrong the first way: it changes the question without telling you

This is what happened above. Deprivation is not a confounder in the small-towns
analysis — it is a **mediator**. Part of what it means to be a large town in
post-industrial England *is* to carry more deprivation. Deprivation sits on the
causal path from size to attainment, rather than sitting outside it muddying the
comparison.

Control for a confounder and you remove bias. Control for a mediator and you
close off part of the causal effect you were trying to measure. You get an
answer to "what if we changed town size but deprivation somehow stayed put?" —
which may be interesting, but is not the question anyone asked, and is not what
your reader will assume you reported.

Adjusted R² goes *up* when you add the mediator. Every model-selection instinct
I was trained on pushes toward the wrong specification.

I got this wrong myself, in a way that is worth admitting because it is the
whole point. The tool I built for this project originally let me hand-pick a
colour for each node in my causal diagram. I coloured deprivation as a
confounder — that is what it intuitively feels like, a background condition
getting in the way. But I had drawn the arrows as
`town size → deprivation → attainment`. My picture and my graph said different
things for weeks and nothing caught it, because the label was an assertion
sitting next to the structure instead of a consequence of it.

The fix was not to be more careful. It was to delete the option: work out what
each variable *is* from the graph itself, and never let anyone declare it. When
two things have to agree, do not check them against each other — derive one from
the other, and the disagreement becomes impossible to express.

## Wrong the second way: it can create bias out of nothing

The first failure is subtle. This one should change how you work.

Take a graph where two hidden causes exist: `U1` affects `X` and `M`; `U2`
affects `M` and `Y`. And crucially, **there is no arrow from `X` to `Y` at
all** — the true effect is exactly zero, by construction.

Simulate 40,000 rows and regress:

```
True effect of X on Y   :  0.000
Naive  (Y ~ X)          : -0.006   ← correct
Adjusted (Y ~ X + M)    : -0.201   ← invented from nothing
```

The naive regression gets it right. **Adding a control variable makes a correct
answer wrong.**

`M` is a **collider** — two arrows point into it. Colliders block the paths they
sit on, so `X` and `Y` start out unassociated, which is exactly what the naive
regression reports. Conditioning on a collider *opens* that path. Once you hold
`M` fixed, learning `U1` tells you about `U2`, and that manufactured association
propagates into a spurious link between `X` and `Y`.

The everyday version: suppose talent and looks are independent in the
population, but either one can get you into Hollywood. Among *actors*, the two
will be negatively correlated — a talentless actor who made it probably got
there on looks. The correlation is pure artefact of looking only at people who
got in. Conditioning on the collider created it. Statisticians call this
Berkson's paradox, or selection bias, and it is the reason "we only had data on
people who signed up" is a sentence that should stop a meeting.

You cannot detect any of this in the output. The fit looks fine. R² improves.
Every diagnostic is unremarkable. The only way to know is to have written down
what causes what, *before* fitting anything.

## The thing that was missing

Here is the same statistical operation — add a variable to a regression — with
three different consequences:

| The variable is a… | Adjusting for it… |
|---|---|
| **Confounder** | removes bias. Required. |
| **Mediator** | changes which question you answered. |
| **Collider** | creates bias that was not there. Never do it. |

The data cannot tell you which case you are in. All three produce correlations
that look identical in the matrix. What distinguishes them is the causal
structure, and causal structure does not live in the data — it comes from
domain knowledge, written down and defended before you fit anything.

The field has a word for this and I did not learn it: **identification.** Not
"what estimate do I get" but "is the quantity I want recoverable at all from the
data I have, under assumptions I am willing to state out loud?" It is a question
about your assumptions, answerable before any data is loaded, and it can fail —
telling you that no amount of modelling will get you what you want.

Judea Pearl's **backdoor criterion** gives the actual rule: adjust for a set of
variables that blocks every non-causal path from treatment to outcome, without
opening any new ones. Note that it is a statement about a *graph*. Not about a
dataframe, a p-value, or a fit statistic.

This is not exotic. It is thirty years old, textbook material in epidemiology
and economics, with mature tooling in Python. It just was not in my degree.

## Why business analytics specifically

Every field has gaps. This one is different because of what the degree is
*for*.

Business analytics is not a descriptive discipline. Nobody commissions an
analysis to learn that two things correlate. They commission it to decide
something: whether to run the campaign, change the pricing, fund the programme,
open in the smaller market. Every one of those is a question about what happens
*if we intervene* — and questions about intervention have a different
mathematical form from questions about association. That is the entire point of
the do-operator.

We were trained on tools that answer the second kind of question, and pointed at
jobs that consist almost entirely of the first kind. The gap gets filled with
folk methodology: control for everything, cite the p-value, add a "correlation
is not causation" disclaimer, and then write recommendations that are causal
anyway because that is what was asked for.

The disclaimer is the tell. Everyone knows the distinction exists. Almost nobody
is taught what to *do* about it.

And the fix is not expensive. Not a new degree, not a semester of measure
theory. A few weeks: DAGs, the backdoor criterion, confounders and mediators and
colliders, and the practice of drawing your assumptions before you fit. It slots
in beside regression, because it is what tells you whether the regression
answers your question. It could reasonably come *before* the machine learning
module — an identification error cannot be fixed by a better estimator, and
gradient boosting applied to the wrong estimand just gets you a very precise
wrong number.

## What it costs to skip it

Back to the towns.

"Children in smaller towns do better academically" is true, and it points
somewhere: at scale, at community, at school size. Reasonable policy follows
from it, about how we build and organise schools in large towns.

"Less deprived places do better academically, and small towns are less deprived"
is also true, of the same data, and points somewhere else entirely: at money.

Identical dataset. Identical correlation. Opposite implications. The only thing
separating them is a causal structure that has to be argued for, made explicit,
and exposed so someone can disagree with it.

I would not have known to ask which one I had. That is what I mean when I say
causality belongs in the curriculum — not as an advanced elective for people who
have finished the real material, but as the thing that decides whether the real
material answers the question you were hired to answer.

---

*The full analysis, the simulated worked examples, and the small library that
derives variable roles from graph structure are in
[causal-duplo](https://github.com/<you>/causal-duplo). Data: ONS,
[Educational attainment of young people in English towns](https://www.ons.gov.uk/peoplepopulationandcommunity/educationandchildcare/datasets/educationalattainmentofyoungpeopleinenglishtownsdata)
(2023), Open Government Licence v3.0.*

*One caveat I would want a reader to carry: the reversal is the most interesting
finding here and the least robust one. Estimating a direct effect by adjusting
for a mediator requires that nothing unmeasured causes both deprivation and
attainment — school funding history, local labour markets, decades of industrial
decline are all plausible candidates and none is in the data. The total effect
rests on weaker assumptions than the direct effect does. That asymmetry is
itself part of what the causal framework makes visible, and it is discussed in
the notebook rather than buried.*
