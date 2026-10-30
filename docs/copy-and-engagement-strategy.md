# FOX2 copy and engagement strategy

This document translates common engagement patterns from fitness trackers,
nutrition products, CGM products, and weight-management products into a FOX2
language system. The goal is useful return behavior: people come back because
FOX2 helps them understand their own response, not because the product creates
anxiety or punishes a missed day.

## What leading products do

### Make the score answer a human question

- Fitbit does not stop at a readiness number. It explains what contributed and
  connects the result to an appropriate level of activity or recovery.
- Oura evaluates scores against personal averages and turns contributors into
  guidance about challenging, light, or limited activity.
- Apple uses a visible goal, then adds personalized coaching that says what is
  needed next.

FOX2 implication: never leave a Fat Use Score to explain itself. Lead with the
person's result in plain language, then provide one next step.

### Turn tracking into a learning loop

- WHOOP combines a journal with behavior-impact insights and a weekly recap,
  then asks whether the person wants to continue or adjust the plan.
- FreeStyle Libre combines graphs with notes for food, exercise, and medicine;
  its reports are framed as a way to discover personal patterns and make more
  informed choices.
- Stelo's Daily Insights pair contextualized metrics with personalized
  recommendations and a reflection prompt.

FOX2 implication: the valuable loop is **measure → notice → connect → try**.
The message should connect the result to the user's named experiment and make
the next useful action obvious.

### Celebrate progress without demanding perfection

- Apple recognizes milestones and significant personal bests, but now allows
  people to pause rings without breaking a streak.
- WeightWatchers explicitly celebrates non-scale victories and treats a flat
  or disappointing number as information rather than failure.
- Noom emphasizes small achievable goals, small wins, and microhabits.
- ZOE uses achievable goals and streaks while emphasizing simple, lower-friction
  actions rather than calorie-counting perfection.

FOX2 implication: celebrate a supported positive shift, not measurement volume.
Never shame a missed day, threaten a lost streak, or present a lower result as
failure. A lower or unchanged result is useful evidence from an experiment.

### Keep feedback specific and personally relevant

Research reviews repeatedly associate engagement with personalized feedback,
self-monitoring, goal setting, prompts, and rewards. Tailored feedback is more
useful than generic congratulations. The best message describes the result,
the comparison, and the next action without making the user decode a chart.

FOX2 implication: `Great job!` is not enough. Prefer: `Great—since starting a
walk after dinner, your Fat Use Score has averaged 18% higher than baseline.`

## What FOX2 should borrow

1. **One useful result first.** Lead with the most relevant supported change.
2. **Name the user's action.** `Since starting Walk after dinner…` is more
   engaging than `Your score increased.`
3. **Use the actual comparison.** Report the percentage and comparison period.
4. **Give one next step.** Keep measuring, review what changed, repeat a useful
   action, or choose the next experiment.
5. **Show why.** Preserve a concise evidence sentence for an optional
   `Why FOX2 says this` disclosure.
6. **Protect autonomy.** Say `try`, `consider`, and `when you're ready`; do not
   command, scold, or imply that the user owes the app more data.
7. **Reward learning.** A completed experiment is valuable even when the score
   falls or does not move.

## What FOX2 should not borrow

- Streak-loss pressure or shame after missed measurements.
- Confetti for routine syncing; celebration should correspond to a meaningful
  personal result.
- Generic motivational filler such as `Keep crushing it!`.
- Red/green moral grading of lifestyle choices.
- Causal claims unsupported by the data. A planned before/after comparison can
  say `since starting`; observational tags should say `associated with`.
- Recommendations that sound like medication or clinical dosing advice.
- Multiple competing calls to action on one screen.

## FOX2 message anatomy

Every generated message may contain four layers, in this order:

1. **Headline:** the result and why it matters.
2. **Detail:** one useful interpretation or next step; omit it if redundant.
3. **CTA metadata:** one optional next action for the interface.
4. **Evidence:** a concise calculation explanation for `Why FOX2 says this`.

Examples:

- **Accumulating:** `Today’s Fat Use Score is 62 so far.`
- **First completed day:** `Your first completed Fat Use Score is 85.`
- **Early positive experiment:** `It’s only been a few days, but since starting
  Zepbound 0.25 mg, your Fat Use Score is already 21% higher.`
- **Established positive experiment:** `Great—since starting Zepbound 0.25 mg,
  your Fat Use Score has averaged 32% higher than your baseline.`
- **Early inconclusive experiment:** `No clear shift yet—since starting Walk
  after dinner, your Fat Use Score is within 1% of your baseline.`
- **Lower result:** `Since starting Earlier dinner, your Fat Use Score has
  averaged 9% lower than your baseline.` The detail should frame this as useful
  evidence and invite review, not as failure.

## Calculation and claim rules

- Never include today's unfinished score in an action-impact claim.
- With a baseline, compare the average of completed post-change daily Scores
  with that baseline.
- Without a baseline and with two or three completed Scores, compare the latest
  completed Score with the first.
- Without a baseline and with four or more completed Scores, compare the recent
  half with the earlier half so one unusual day does not dominate the message.
- Treat changes smaller than 3% as `stable` by default. Report the percentage,
  but do not celebrate noise as a win.
- Use `since starting [action]` for planned experiments. Use `associated with`
  for observational tags or retrospective correlations.

## Engagement opportunities for FOX2

### 1. Add a one-tap reflection after an unusual completed day

Prompt: `Yesterday stood out. What was different?` Offer existing tags, not a
new graph. This improves the usefulness of later insights while the memory is
fresh.

### 2. Turn positive associations into repeatable experiments

When the evidence is sufficient: `Your evening walks are associated with
higher next-day Scores. Try the same walk three more times?` This closes the
learning loop without pretending correlation is causation.

### 3. Add a weekly “one finding, one next step” recap

Use the existing bar chart. Above it, show one supported finding and one action.
Do not create a dashboard of secondary metrics.

### 4. Make “What you’ve learned” cumulative and useful

Keep completed experiments as a personal evidence library with the action,
date range, result, and a `Try again` affordance. This makes historical data
feel like acquired knowledge rather than an archive.

### 5. Use gentle re-entry instead of streak pressure

After a gap: `Welcome back. One measurement today is enough to restart your
pattern.` Do not mention a broken streak or lost progress.

### 6. Time prompts to moments of utility

Prompt after a completed day, after enough evidence for a comparison, or when a
saved action can be reviewed. Avoid repeatedly notifying the user that more
data would be nice.

### 7. Let people choose the next experiment

Offer a small set of user-controlled choices based on their own history. The
copy generator returns CTA metadata so the interface can present one relevant
choice without embedding navigation logic in the language layer.

## Sources reviewed

- [Apple Watch activity coaching and awards](https://www.apple.com/nz/watch/close-your-rings/)
- [Apple activity customization and pauseable streaks](https://www.apple.com/uk/newsroom/2024/06/watchos-11-brings-powerful-health-and-fitness-insights/)
- [Fitbit/Google readiness score and personalized guidance](https://support.google.com/googlehealth/answer/14236710?hl=en)
- [Oura Readiness contributors and personal averages](https://support.ouraring.com/hc/en-us/articles/360057791533-Readiness-Contributors)
- [WHOOP behavior insights](https://support.whoop.com/s/article/WHOOP-Journal-Overview?language=en_US)
- [WHOOP weekly plans and recaps](https://support.whoop.com/s/article/Weekly-Plan?language=en_US)
- [FreeStyle Libre app patterns, notes, and reports](https://www.freestyle.abbott/en-us/products/freestyle-libre-app.html)
- [FreeStyle Libre progress and small-step framing](https://www.freestyle.abbott/en-us/libre-living/spotting-glucose-trends.html)
- [Dexcom Stelo contextual Daily Insights](https://investors.dexcom.com/news/news-details/2026/Stelo-Adds-Enhanced-Smart-Meal-Logging-Features-as-Dexcom-Continues-to-Transform-Personal-Glucose-Management/default.aspx)
- [ZOE achievable goals and streaks](https://zoe.com/en-us/app)
- [Noom small wins and achievable microhabits](https://www.noom.com/blog/longevity/blueprint-for-everyday-wellbeing/)
- [WeightWatchers non-scale victories](https://www.weightwatchers.com/us/blog/non-scale-victories)
- [Mobile health engagement review](https://pmc.ncbi.nlm.nih.gov/articles/PMC9231655/)
- [Behavior-change techniques and engagement review](https://pmc.ncbi.nlm.nih.gov/articles/PMC10545861/)
- [Self-monitoring feedback review](https://pmc.ncbi.nlm.nih.gov/articles/PMC10765525/)

