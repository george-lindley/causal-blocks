# IELTS by nationality (DAG 3)

`dag3_nationality.csv`: one row per test type × year × nationality (236 rows), mean IELTS band scores
for 2022-23 to 2024-25, from IELTS's published test statistics via #TidyTuesday (2026-08-18), with
English-language status per nationality from Wikipedia (pinned revision 1378630797) and World Bank region.

Built for the blog post [Does official English make people speak better than they write?](https://georgelindley.com/does-official-english-make-people-speak-better-than-they-write/).
`english_any` is the treatment (any English status except "not listed"); `speak_minus_write` the outcome.
Rows are national averages, not people, and only people who chose to sit IELTS appear.
