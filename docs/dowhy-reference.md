# DoWhy reference

Notes I kept while learning DoWhy, for the things I had to look up more than
once. This started life as `blocks/dowhy.py` — 208 lines of `print()` statements
behind a `dowhy_help(topic)` dispatcher. It was documentation wearing a function
call as a disguise: not testable, not searchable, not linkable, and it forced a
Python import to read a paragraph. Markdown is what it always wanted to be.

## The workflow

DoWhy separates four steps that most regression workflows blur into one. The
separation is the point: it forces you to write down your assumptions before you
see a number.

```python
model    = CausalModel(data=df, treatment="X", outcome="Y", graph=dag.to_dot())
estimand = model.identify_effect()                     # what can be computed, given the graph
estimate = model.estimate_effect(estimand, method_name=...)   # compute it
refuted  = model.refute_estimate(estimand, estimate, method_name=...)  # try to break it
```

1. **Model** — state your assumptions as a graph.
2. **Identify** — ask whether the effect is computable *at all* from observed
   data under those assumptions. This is a question about the graph, not the
   data; it can fail before you ever touch a number.
3. **Estimate** — only now does the data get used.
4. **Refute** — try to break your own result.

Step 2 is the one with no counterpart in ordinary regression, and it is the one
that matters. `identify_effect()` returns an *estimand*: a formula saying which
variables to adjust for. Print it. If it names a variable you did not expect,
your graph disagrees with you.

## Estimation methods

### Backdoor methods

Adjust for a set of variables that blocks all backdoor paths.

| Method | Treatment | Use when |
|---|---|---|
| `backdoor.linear_regression` | continuous or binary | relationships are roughly linear |
| `backdoor.propensity_score_matching` | **binary only** | you want to compare like with like |
| `backdoor.propensity_score_weighting` | **binary only** | reweighting to balance groups |
| `backdoor.propensity_score_stratification` | **binary only** | subclassification analysis |

The propensity-score family models the probability of receiving treatment given
covariates, then uses it to make treated and untreated groups comparable. All
three require binary treatment — passing a continuous one produces a confusing
error rather than a clear refusal.

### Instrumental variables

| Method | Requires |
|---|---|
| `iv.instrumental_variable` | a valid instrument in the graph |

Use when you suspect **unobserved** confounding, which no amount of adjustment
can fix. An instrument affects the treatment but reaches the outcome only
*through* the treatment. `CausalDAG.roles()` will tell you which of your
variables qualify structurally — though the untestable part of the assumption
(no unobserved path from instrument to outcome) is still yours to defend.

### Frontdoor

| Method | Requires |
|---|---|
| `frontdoor.two_stage_regression` | a fully mediating variable, itself unconfounded |

Rarely applicable — it needs a mediator that captures the entire effect and has
no confounding of its own. Worth knowing exists; do not go looking for it.

## Choosing a method

| Treatment type | Use | Avoid |
|---|---|---|
| Continuous | `backdoor.linear_regression`, `iv.instrumental_variable` | all propensity-score methods |
| Binary | any backdoor method, `iv.instrumental_variable` | — |

Then narrow by: which identification strategies the graph actually offers, which
assumptions you are willing to defend in writing, and sample size.

## Refutation tests

Refutations do not prove an estimate is right. They check it fails in the ways a
correct estimate should fail. Passing them all is weak evidence; failing one is
strong evidence of a problem.

| Test | What it does | Expected result |
|---|---|---|
| `random_common_cause` | adds an independent random confounder | estimate barely moves |
| `placebo_treatment_refuter` | replaces treatment with noise | new estimate ≈ 0 |
| `data_subset_refuter` | re-estimates on random subsets | estimate barely moves |
| `add_unobserved_common_cause` | simulates confounding you did not measure | shows how strong hidden confounding would have to be to overturn the result |

The last one is the most informative and the least used. It answers the question
a sceptical reader actually has: *how much would you have to have missed for this
to be wrong?*

## Synthetic data generators

DoWhy ships generators with a known ground truth, which is the only way to check
an estimator honestly.

```python
dowhy.datasets.linear_dataset(beta=1.5, num_common_causes=2, num_instruments=1,
                              treatment_is_binary=False)
dowhy.datasets.xy_dataset(effect=1.2, sd_error=0.2)
```

| Parameter | Meaning |
|---|---|
| `beta` / `effect` | the true causal effect — what a good estimator should recover |
| `num_common_causes` | confounders to create (`W0`, `W1`, …) |
| `num_instruments` | instruments to create (`Z0`, `Z1`, …) |
| `sd_error` | noise standard deviation |
| `treatment_is_binary` | make treatment 0/1 rather than continuous |

`duplo.simulate` covers the same ground from a DAG you wrote yourself, with
`true_total_effect()` as the ground truth. Use DoWhy's when you want a standard
setup; use `duplo`'s when the graph shape is the thing you are studying.

### Fat-tailed noise

Everything above assumes Gaussian noise. Real economic and social data often is
not, and estimators that look fine under normality can behave badly when
variance is large or undefined:

```python
np.random.pareto(a=1.16, size=n)          # power law, the "80/20" shape
np.random.standard_t(df=3, size=n)        # df=3 very heavy; df -> inf approaches normal
scipy.stats.levy_stable.rvs(alpha=1.5, beta=0, size=n)   # alpha < 2 -> infinite variance
```

Worth trying once against any method you plan to rely on. Confidence intervals
built on a finite-variance assumption do not mean what they claim when variance
is infinite.

## Things that cost me time

- **Check the treatment type before choosing a method.** Most confusing errors
  trace back to a propensity-score method receiving continuous treatment.
- **Print the estimand.** It tells you what DoWhy thinks it is adjusting for,
  which is not always what you think you asked for.
- **A mediator in your adjustment set changes the question**, not just the
  precision. You get the direct effect, and nothing warns you. This is what
  `CausalDAG.explain()` exists to catch.
- **Cross-check with more than one method.** Agreement is reassuring;
  disagreement locates the assumption doing the work.
