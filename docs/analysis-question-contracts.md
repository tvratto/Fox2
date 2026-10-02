# FOX2 analysis question contracts

Status: working product specification. This document describes intended behavior; it does not mean the current website or firmware implements every rule below.

## Purpose

FOX2 should answer the metabolic questions supported by a person's own data. It should not present a fixed checklist, lead with statistical terminology, or show a visual whose timeframe differs from the answer it is meant to support.

The order is always:

1. The person's question.
2. A short answer about what it may mean for their body.
3. One clear thing to keep doing or try next.
4. A simple visual that supports the answer.
5. Optional detail showing the numbers and calculation.

FOX2 selects the most relevant questions from the evidence. It should normally show one primary answer and no more than two secondary answers.

### Narrative order

The analysis begins with the person's main question and then shows the most useful supporting context:

1. **Am I making progress?** One answer that combines the current week, the latest 14 calendar days, and the strongest relevant sign of progress.
2. **Could I be stalled?** A conditional answer when recent Daily Fuel Scores remain below the higher range and have stayed level or gone down. The answer includes any encouraging within-day evidence and the status of a repeated tagged experiment.
3. **Where am I now?** The person's recent Low, Balanced, Higher, or Strong fuel-use range.
4. The longer weekly and complete-history trends that support the answer.

“How is this week going?” is evidence for “Am I making progress?” It should not repeat the same conclusion in a separate top-level card.

An event older than five calendar days may support the longer analysis, but FOX2 should not ask the person to remember what happened before it. In the main answer, use a natural label such as “Yesterday afternoon” or “Last Friday morning.” Put the exact date in the supporting detail.

Repeated-tag evidence belongs inside the question it helps answer. If FOX2 asks the person to tag something, that same section must say what FOX2 is testing, count the usable examples, and eventually report the result. A claim that a shift is showing up on more days requires a direct comparison with an earlier period; ordinary differences between days are not enough.

## Shared language

### Customer-facing concepts

| Internal concept | Customer-facing language |
| --- | --- |
| Individual breath-acetone reading | Fat Zone |
| Daily AUC | Daily Fuel Score |
| Higher breath-acetone signal | Your Fat Zone went up |
| In-day variability / responsive day | Your Fat Zone went up and came back down |
| Week-to-week score increase | Your average score went up |
| Narrower day-to-day range at a higher level | Your scores went up and stayed up more often |
| Low, flat pattern | We are not seeing a clear increase yet |
| High, flat pattern | Your Fat Zone has stayed high for a long time |
| Insufficient data | FOX2 is still building your starting point |

Avoid customer-facing terms such as `classifiable`, `responsive`, `variability`, `state`, `quiet`, `inconsistent`, and `opened quietly` unless they are immediately translated into ordinary language.

### Voice rules

FOX2 should sound like a thoughtful coach—not like a report.

- Aim for a sixth-grade reading level.
- Use short sentences and short paragraphs.
- Lead with what the pattern may mean, not the calculation.
- Give the person a clear direction: keep going, repeat something that worked, or try one small change.
- Put the person or their results first: “Your scores went up,” not “An upward change was observed.”
- Prefer ordinary verbs: `went up`, `came down`, `stayed about the same`, `went up and down`, and `happened more often`.
- Avoid softened abstractions such as `moved higher`, `showed an upward trajectory`, `displayed responsiveness`, and `demonstrated improved repeatability`.
- Say “Fat Zone” when discussing a reading and “Daily Fuel Score” when discussing a day. Do not call both of them “your numbers.”
- Use `drawing on fat for energy` in progress messages. It is short, conversational, and appropriately qualified with `may` or `your results suggest`.
- Do not use Fat Zone or Daily Fuel Score as the main progress message. Use them only under “Why FOX2 says this.”
- Keep the main answer to two or three short sentences.
- Keep most exact numbers, thresholds, averages, and methods under “Why FOX2 says this.”
- Use contractions where they sound natural: “We’re not seeing…” and “That hasn’t shown up in your weekly average yet.”
- Read every customer-facing sentence aloud. If it would sound unnatural in a supportive conversation, rewrite it.

### The two FOX2 measures

- **Fat Zone** is the number from an individual measurement. It can range from 1 to 20, although most readings are between 1 and 10.
- **Daily Fuel Score** is the area under the Fat Zone curve for the day. A higher Fat Zone, more time at a higher Fat Zone, or both will raise the Daily Fuel Score.

The customer explanation is:

> Your Fat Zone shows what FOX2 found in one breath measurement. Your Daily Fuel Score adds up how high your Fat Zone was and how long it stayed there during the day.

The metabolic bridge is:

> These results may suggest that your body is drawing on fat for energy more often, for longer, or across more days.

Use `suggests`, `may`, and `appears` for metabolic meaning. Breath acetone supports an inference about making ketone fuel from fat. It does not directly measure total fat burned, body-fat loss, or the exact share of energy coming from fat.

### Daily Fuel Score tiers

The analysis uses four internal tiers to interpret a person's recent position:

| Daily Fuel Score | Internal interpretation | Main customer meaning |
| --- | --- | --- |
| 0–60 | Low fat use | Building toward balanced fuel use |
| Above 60 through 120 | Balanced fuel use | A steady pattern that may be useful for maintenance; stronger days may show how to move higher if body-fat reduction is the goal |
| Above 120 through 180 | Higher fat use | The FOX2 range where body-fat loss may become more likely |
| Above 180 | Strong fat use | High and sustained; focus on adequate food, protein, and sustainability rather than always pushing higher |

These are product probability tiers, not clinical cutoffs or guarantees. The main message does not lead with the numbers. It says whether the person is building toward balanced use, holding a balanced pattern, getting close to the next range, already reaching it on some days, or sustaining a higher range. Exact averages, thresholds, and day counts belong under **Why FOX2 says this**.

Recent position and direction are separate. Someone holding steady in balanced fuel use needs a different message from someone near the top of that range who already reaches higher fat use on several days, even if neither has a large week-over-week increase.

### Evidence types must remain separate

| Evidence | What it can answer | What it cannot answer by itself |
| --- | --- | --- |
| Fat Zones during one day | Whether the Fat Zone went up or came back down that day | Whether the person is making multi-week progress |
| Daily Fuel Scores | Whether the Fat Zone was higher, lasted longer, or both across measured days | What happened inside any one day |
| Monday-Sunday summaries | How one week compares with another | What caused the difference |
| Repeated tags | Whether a repeated choice is associated with later measurements or scores | Whether the choice caused the result |
| Complete personal history | Personal highs, lows, streaks, and whether a change has lasted | Clinical outcomes such as fat loss, muscle loss, A1C change, or resting metabolic rate |

The requirement for at least three measurements spanning six hours applies only to conclusions about change within a day. It must never remove a valid saved Daily Fuel Score from daily or weekly score comparisons.

## Question inventory

| Priority | User question | Underlying concern | Primary timeframe | Minimum evidence | Possible answer families | Supporting visual |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Am I making progress? | Is my body drawing on fat for energy more often, for longer, or across more days? | Several timescales, from the latest well-measured day through completed calendar weeks | Depends on the sign of progress; each answer must state its timeframe and evidence strength | Happening more often; lasting longer; showing up across more days; not clear yet | One small visual for each sign of progress being described |
| 2 | Could I be stalled? | If I am trying to reduce body fat, do my recent results help explain why progress feels stalled? | Latest seven calendar days, with longer history for context | At least four saved Daily Fuel Scores; recent average below 120; later scores roughly level or lower | Possibly stalled with an encouraging sign; possibly stalled with a tagged experiment; not currently supported | Seven-day score direction plus only the within-day evidence used in the answer |
| 3 | Is my body drawing on fat for energy more often? | Does the Fat Zone go higher than it used to? | Recent measured days, with history for context | At least two Daily Fuel Scores or one well-measured day | Not seen yet; seen briefly; happening more often; lasting longer | Highlighted higher days or a specifically named day curve |
| 4 | Does my Fat Zone change during the day? | Does the pattern suggest that fat use changes as the day changes? | Several individual days | At least three readings spanning six hours on each included day | Not enough coverage; little change; changes on some days; changes often | Small multiples: one clearly labeled curve per date |
| 5 | Is this shift showing up on more days? | Is the change happening often, not just once in a while? | Completed weeks | At least four Daily Fuel Scores in each compared week | Too early; promising but occasional; happening across more days; continuing | Weekly average with day-to-day range |
| 6 | What stood out recently? | Did a recent day genuinely differ from my own history? | Latest five calendar days | A result that is unusual relative to enough personal history, not merely the latest qualifying rise | Unusually strong score; unusually large or long rise; repeated tag association; nothing worth showing | The named day or period only |
| 7 | Could I be pushing too hard? | Has my Fat Zone stayed very high without coming back down? | Recent weeks | Repeated high Daily Fuel Scores plus enough Fat Zone readings across the day | No such pattern; check that you are eating enough; the pattern has continued and may be worth discussing with a professional | Weekly trend plus clearly labeled high, steady days |
| 8 | What appears to be helping? | Which repeated choices are followed by a more favorable pattern? | Repeated tagged occasions | Threshold depends on comparison type; see tag contract | Still gathering; same-day association; later-reading association; next-day association | Tagged versus comparison occasions |
| 9 | How is this week going? | Is the current week supporting progress, holding steady, or offering time to recover? This is supporting evidence for “Am I making progress?”, not a separate headline card. | Current Monday through last measured day | One or more Daily Fuel Scores this week | Early start; ahead of the same point last week; similar; behind with time to act; recovering | Current week versus the same weekdays last week |
| 10 | What should I try next? | What is the smallest useful experiment based on my evidence gap? | Current evidence state | Any amount of data | Measure across more of the day; repeat a promising choice; try one sustainable change; protect adequate food/protein intake | Usually no chart; link to the evidence that motivated the suggestion |
| 11 | Is this my strongest period so far? | How does the current period compare with my own history? | Complete history | At least three usable completed weeks | New personal high; among stronger periods; within usual range | Current week highlighted against personal history |
| 12 | Is the change lasting? | Has the better pattern lasted beyond one good day or week? | Several completed weeks | At least three weeks that can be fairly compared | Too early; starting; lasting; eased recently | Weekly summaries in date order |
| 13 | What happened on this day? | How did my Fat Zone change that day? | One named date | Readings from that date | Went up; came down; went up and came back down; changed little; not enough readings | One curve titled with the exact date |

## Contract 1: Am I making progress?

### What the person is really asking

“Is my body drawing on fat for energy more often, for longer, or across more days?”

This question has more than one answer. Progress may first appear briefly. It may then happen more often, last longer, or show up across more days.

FOX2 should call out each sign of progress that is present. It should also say whether the change is new or has lasted.

### Progress ladder

The analysis should help a person see where progress is appearing:

1. **First sign:** “Your body may be drawing on fat for energy, but only briefly.”
2. **Happening more often:** “Your results suggest your body is drawing on fat for energy more often.”
3. **Lasting longer:** “Your body may be drawing on fat for energy for more of the day.”
4. **Across more days:** “This shift toward fat for energy is showing up on more days.”
5. **Lasting over time:** “This shift has continued for several weeks.”
6. **Not clear yet:** “We’re not seeing a clear shift toward fat for energy yet.”

These steps do not always happen in order. FOX2 should say what is changing now and what has not changed yet.

### Signs of progress

Daily Fuel Scores use every day with a saved score. A missing day is never counted as zero. FOX2 only talks about changes within a day when there are at least three measurements spread across six hours.

| Sign of progress | Question it answers | Comparison | Minimum evidence | Main answer and direction | Matching visual |
| --- | --- | --- | --- | --- | --- |
| Fat Zone goes higher than usual | “Is my body starting to change?” | Latest well-measured day or two versus the person's recent pattern | One well-measured recent day plus enough earlier measurements to know what is usual | “Your body may be drawing on fat for energy, but only briefly. [Day and time] stood out. Look back at what was different before then and choose one safe part to try again.” | The named day's curve over a light band showing the usual range |
| Fat Zone goes up more often | “Is this happening again?” | Recent well-measured days versus an earlier group | Several well-measured days in each period | “Your results suggest your body is drawing on fat for energy more often. Look at what happened before these times and choose one thing to test again.” | Two simple counts with the exact numbers in the detail view |
| Daily Fuel Scores go up | “Is the change lasting longer?” | Daily Fuel Scores within the current week or most recent measured days | At least three Daily Fuel Scores, without filling missing days | “Your body may be drawing on fat for energy for more of the day. Look at what your stronger days had in common and repeat one part.” | Dated score markers connected only where dates are consecutive |
| One stronger day | “Did I have a strong day?” | Latest Daily Fuel Score versus the person's recent scores | One completed score plus enough earlier score days to know what is usual | “Your body may have spent more time drawing on fat for energy yesterday. Think about what was different the night before and that morning. Choose one safe part to try again.” | Latest day highlighted against the recent range |
| More higher-scoring days | “Is this happening across more days?” | Current or latest complete week versus an earlier week | Enough score days in both periods for a fair comparison | “This shift toward fat for energy is showing up on more days. Look for one routine your stronger days shared and test it again.” | The useful band count, with exact thresholds in the detail view |
| Weekly average goes up | “Is this becoming a wider change?” | Completed Monday-Sunday weeks | At least two completed weeks with enough score days | “This shift toward fat for energy is showing up across the week. Compare your stronger week with the week before and choose one change to keep.” | Weekly average and daily range, up to eight completed weeks |
| Higher scores happen more often | “Can I repeat this?” | Latest completed week versus earlier weeks | Enough score days in each week | “This shift is happening more often. Keep the routine that appears most often before your stronger days.” | Weekly average with a stable or smaller daily range |
| Higher scores continue | “Is the change lasting?” | Three or more completed weeks | At least three comparable completed weeks | “This shift has continued for several weeks. Focus on the parts of your routine that are safe and easy to keep.” | Weekly trend showing the improvement continuing |

### How FOX2 composes the answer

The signs of progress are not separate, competing states. FOX2 may report several at once. For example:

> Your results suggest your body is drawing on fat for energy more often, but only briefly. Wednesday afternoon stood out. Think back to what was different from Tuesday evening through Wednesday morning. Choose one safe part of that routine to repeat and tag it next time.

Put the supporting data under **Why FOX2 says this**:

> Your Fat Zone went above its usual range on several recent days. Your Daily Fuel Scores also went up. Your weekly average has not gone up yet.

The answer should contain:

1. A short answer about what the pattern may mean.
2. One clear direction for the person.
3. No more than two signs of progress in the main answer.
4. A short note saying whether the change is new or has lasted.
5. Exact values and methods only in the supporting detail.

The interface may display these as separate short observations beneath the umbrella question, but it should not repeat the same conclusion in several sections.

### Guidance must come from the event

Do not end with a generic line such as “Keep doing what seems to help.” Use the person's data to point them toward a specific time and a small next step.

When a day or part of a day stands out:

1. Name the day and part of the day.
2. Look back over the period that may matter. For an afternoon rise, this may include the night before and that morning.
3. Check for tags during that period.
4. Ask the person to choose one safe, repeatable part of the routine to test again.
5. Ask them to tag it next time so FOX2 can see whether the pattern happens again.

Only give this look-back prompt when the event occurred within the latest five calendar days.

Use the best message supported by the available context:

**No useful tag yet**

> Wednesday afternoon stood out. Think about your meals, activity, and sleep since Tuesday evening. Pick one thing that was different and tag it if you try it again.

**One possible tag**

> Wednesday afternoon stood out after you tagged a morning walk. We haven't seen this enough times to know whether the walk helped. Try it again and tag it so FOX2 can see if the pattern happens again.

**A tag with enough repeats**

> Your results have gone up several times after a morning walk. The walk may be helping your body draw on fat for energy. Keep it in your routine if it works for you.

Never say that a tag caused the change. Say `may be helping`, `happened after`, or `appears before your stronger results`.

### Strength and ordering

Start with the strongest sign FOX2 can support:

1. Higher scores continuing across several completed weeks.
2. Weekly average going up.
3. Higher scores happening more often.
4. More higher-scoring days.
5. Daily scores going up.
6. Fat Zone going up more often during the day.
7. One recent strong day or higher Fat Zone.

An early change still matters. FOX2 should call it a promising start, not proof of a lasting change.

If indicators disagree, say so without turning the result into a negative label. For example:

> This shift toward fat for energy is showing up on recent days, but it has not lasted across the week yet. Look at what happened before your stronger days and choose one safe part to repeat.

### “No clear increase yet” is also multi-scale

FOX2 should only say this after checking every possible sign of progress. It should give the person a simple next step:

- “We’re not seeing a clear shift toward fat for energy yet. Try one small change and see what happens.”
- “Your body may be drawing on fat for energy, but only briefly. Look at what happened before those times and choose one safe part to try again.”
- “You had one stronger day. Try part of that routine again and see if it happens again.”

This keeps a weekly average from hiding an early change. It also keeps one unusual day from sounding like a lasting result.

### Visual contract

There is no single progress chart. Each claim gets a small visual using the same timeframe and data:

- A weekly claim uses a completed-week chart.
- A current-week daily-score claim uses dated daily score markers.
- A claim that the Fat Zone goes up more often uses two clearly named periods.
- A claim about one strong day uses that day's Fat Zone curve and the person's usual range.
- A one-day curve must never be presented as proof of a weekly trend.

Every visual needs a short title that says what time it covers, such as “Your completed weeks,” “Your Daily Fuel Scores this week,” or “Your Fat Zone on September 29.”

### Internal thresholds to test

These numbers drive the analysis. They do not belong in the main customer message.

- A weekly or multi-day Daily Fuel Score change of 10 points or more is provisionally meaningful.
- A change of 20 percentage points or more in days above a threshold or days with clear within-day movement is provisionally meaningful.
- “Becoming easier to repeat” provisionally requires the mean to rise by at least 10 while the day-to-day range does not widen materially; the earlier proposal requiring the range to narrow by 10 may be too restrictive.
- A trend within the current week must use at least three saved Daily Fuel Scores and must disclose the exact number of measured days.

These are product hypotheses, not validated biological cutoffs. We should test them against Tim's and Maggie's histories and additional users.

### Optional detail disclosure

The expanded explanation may say:

> FOX2 looks for change in three places: your Fat Zone during the day, your Daily Fuel Scores across days, and your weekly pattern. Each answer tells you which period it covers.

### Claim boundary

This answer may say that the results suggest the body is drawing on fat for energy more often, for longer, or across more days. It must not say that the person burned a specific amount of fat, lost body fat, preserved or lost muscle, changed A1C, changed resting metabolic rate, entered starvation mode, or that a tagged choice caused the change.

## Contract 2: Could I be stalled?

### What the person is really asking

“If I am trying to reduce body fat, do my recent results help explain why progress feels stalled—and is there anything encouraging I can build on?”

FOX2 does not know the person's goal and does not measure weight loss directly. The answer must therefore begin with `Possibly` and use conditional wording: `If you’re trying to reduce body fat...`

### When the answer appears

The Analysis page shows this question when all of these are true:

1. The latest seven calendar days contain at least four saved Daily Fuel Scores.
2. Missing days are ignored, never filled with zero.
3. The seven-day average is below 120, FOX2's internal boundary for the range where body-fat loss becomes more likely.
4. Either the latest three scored days have gone down by at least five points overall, or the later half of the seven-day window averages no more than five points above the earlier half.

The question does not appear when the recent average is 120 or higher, when there are fewer than four scored days, or when the later part of the week has clearly gone up.

The Analysis page must continue to answer this question whenever the evidence supports it. A three-to-four-day cooldown applies only to proactive device prompts or notifications, so the person is not repeatedly interrupted by the same message. It must not hide the answer when the person deliberately opens Analysis.

### Answer composition

The main answer has three parts:

1. **Possibly stalled:** explain that the recent scores remain below the higher range and have stayed about the same or gone down.
2. **Encouraging evidence:** call out higher-range days, recurring Fat Zone changes, or another real sign that the person can build on. Describe a recurring pattern as recurring; never present an ordinary day as a unique event.
3. **Helpful association, when supported:** include a positive repeated tag result. Keep inconclusive and negative tag findings silent.

Example:

> Possibly. If you’re trying to reduce body fat, your recent results may help explain why progress feels stalled. Your Daily Fuel Scores have stayed about the same and remain below the range where body-fat loss becomes more likely. The encouraging part is that you already reach the higher range on some days.

### Tag analysis

For normal coaching, FOX2 analyzes the most-used tags from the latest eight weeks ending on the latest measurement date. It first ranks tags by how often the person actually uses them, then evaluates positive associations among the three most-used tags. Older data does not displace a current, frequently used behavior merely because an old tag produced one dramatic result.

`What may be helping?` appears only for a supported positive association:

| Evidence timescale | Requirement | Customer-facing meaning |
| --- | --- | --- |
| After an activity | At least five timed tagged occasions; at least half followed by the required measurement increase | “Walking may be helping your metabolism shift toward using more fat for energy afterward.” |
| Across the tagged day | At least five tagged score days and five comparison days; tagged median at least five points higher | “On days you walk, your results suggest your body may use fat for energy for more of the day.” |
| The following day | Enough tagged follow-up and comparison days; next-day median at least ten points higher | “Your results suggest walking may support more fat use into the following day.” |

Exact qualifying counts belong under `Why FOX2 says this`, phrased as “This pattern appeared after 6 of 9 recent tagged walks.” The main answer must describe the metabolic meaning, not announce a Fat Zone calculation.

Inconclusive tags, unused tags, and tags without a positive association remain silent. FOX2 must never tell someone that walking, running, or another choice is “not working.” A breath-acetone result cannot measure every benefit of that behavior.

### Complete-history rescue during an extended stall

The deeper historical search activates only when all of these are true:

1. The latest 21 calendar days contain at least 12 saved Daily Fuel Scores.
2. The average remains below 120.
3. The later half of the period averages no more than five points above the earlier half.
4. No positive association is available among the most-used tags from the latest eight weeks.

FOX2 then searches the earlier personal history for one strong, repeated positive association. Historical evidence uses a higher bar than current evidence: at least seven immediate occasions with a 60% response rate, at least seven tagged same-day comparisons with an eight-point lift, or at least five following-day comparisons with a twelve-point lift.

The message must clearly describe the result as earlier evidence:

> Earlier in your history, walking may have helped your metabolism shift toward using more fat for energy afterward. If walking still works for you, it may be worth trying again and using the same tag so FOX2 can see whether the pattern returns.

Timed tags may be compared with measurements before and after the event. Day-level tags may be compared with same-day and next-day Daily Fuel Scores. A tag can show an association, never causation.

### Claim boundary

The stall answer may say that FOX2 results could help explain why body-fat progress feels stalled. It must not say that weight loss has definitely stopped, that a meal or activity caused the pattern, or that the person has damaged their metabolism. The 120 boundary is a FOX2 product hypothesis based on internal observations, not a clinically validated cutoff or guarantee.

## Remaining contracts to decide together

For each remaining question, we should settle the decisions below before changing the interface.

| Question | Most important unresolved decision |
| --- | --- |
| How is this week going? | Whether comparison is always the same weekdays last week, the previous full-week average, or both in a strict hierarchy |
| Is my body drawing on fat for energy more often? | Whether one well-measured day is enough for an early “yes,” and how to explain the difference between a brief rise and a change that lasts |
| Does my Fat Zone change during the day? | Whether a return must happen before midnight or may happen within the current 72-hour rule |
| Is this shift showing up on more days? | Whether this requires a smaller score range, more days above a threshold, or both |
| Could I be pushing too hard? | The duration and thresholds that justify a careful protective prompt without implying a diagnosis |
| What appears to be helping? | Exact minimum repeats for later-reading, same-day, and next-day tag comparisons |
| What should I try next? | The priority order among measurement coverage, repeating a promising choice, and trying a new sustainable choice |
| Is this my strongest period so far? | Whether to compare means, medians, threshold-day counts, or a named combination |
| Is the change lasting? | How many weeks show that a change is starting versus lasting |
| What happened on this day? | The simplest words for went up, came down, and changed little |

## Current implementation gaps

These are specification gaps, not necessarily software defects:

1. “Am I making progress?” is currently treated as one selected conclusion. The intended contract joins all useful signs of progress, from one higher Fat Zone through a change that lasts for weeks. Each statement needs its own matching evidence.
2. Weekly score comparisons and Fat Zone changes within a day are not always separated in visible language.
3. The current response-return rule may extend as far as 72 hours, although the interface describes the result as change “during the day.”
4. Several useful historical signals already calculated by the state engine—personal highs, threshold streaks, and first higher-use weeks—are not yet translated into customer questions.
5. The interface now ranks a first set of evidence-backed secondary questions—stall, sustained high results, a change lasting across completed weeks, a personal-best period, a genuinely unusual recent day, and a data-based next step—and shows no more than two. The remaining inventory still needs agreed contracts before it joins the router.

## Review workflow

We will refine one question at a time:

1. Agree on what the person is truly asking.
2. Agree on timeframe and minimum evidence.
3. Walk through every answer state using real or constructed examples.
4. Approve customer wording and claim limits.
5. Approve the visual contract.
6. Test the contract against Tim's and Maggie's complete histories.
7. Only then implement it in the website and, where appropriate, firmware.

Before moving to the next question, test every sign of progress against Tim's and Maggie's histories. Check that the rules produce useful, truthful answers. Then review “How is this week going?” so it adds something new instead of repeating the progress answer.
