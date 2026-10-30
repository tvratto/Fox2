# FOX2 web visual language

The web app uses black, white, neutral greys, and FOX2 orange as its primary
visual system. The canonical orange token is:

```css
--program-orange: #ff8c00;
```

## Progress

The Progress tab uses only the established Fat Use Score ring and a 30-day
history chart. Both use orange for score data.

- The synced Fat Use Score ring is orange.
- The chart has 30 fixed positions. Completed daily scores begin at the left
  and fill toward the right, while open positions make the remaining progress
  toward day 30 visible. Weekly date labels remain on the X-axis beneath the
  bars.
- Each completed day is an orange vertical bar. Do not connect the bar tops
  with an additional line or curve.
- The entire chart shares one vertical score scale so every daily height can be
  compared directly.
- Today’s unfinished bar uses a thin yellow outline; do not place a `SO FAR`
  text label beside it.
- When completed change records exist, a compact `What you’ve learned` list below
  the chart names each change, shows its starting and ending dates beside the
  name, and states its measured Fat Use Score impact. Use a subtle orange-tinted
  container and stronger impact text to distinguish this record from the graph.
- Bar height, score labels, and the optional baseline reference communicate
  value and comparison; bar color does not encode score tiers.
- The baseline uses one dotted white reference across the chart so it remains
  subordinate to the orange score data.
- A large plain-language summary appears before the graph and describes the
  visible result conversationally. Do not place a smaller explanatory
  subheading beneath it. When a comparison exists, follow the summary with one
  large typographic hero result: an arrow, the percentage, and a short reference
  label such as `ABOVE BASELINE`. This is not a new graph. Positive upward or
  above-baseline summaries begin with `Great—` when the result is established.
- Progress summaries are short, specific, and encouraging. Describe the
  visible outcome without stating how many measurements or days are present.
- Before a reliable trend is available, use one conversational sentence that
  names the action, then show the actual percentage as the hero result (for
  example: “It’s only been a few days, but since starting Zepbound 0.25 mg,
  your Fat Use Score is already higher.” followed by `↑ 12% ABOVE BASELINE`).
  Do not use vague language such as `taking shape`.
- Resolve Progress copy through `graphs/copy-generator.js`: empty,
  accumulating, first result, early comparison, or established comparison.
  Baseline comparisons use the average of completed post-change daily Scores;
  today’s unfinished Score is never included. Without a baseline, compare the
  latest completed Score with the first for early results, then compare recent
  completed Scores with earlier completed Scores once more history is present.
- Changes under 3% are treated as stable by default so small fluctuations are
  not celebrated as meaningful wins. Generated messages keep a calculation
  explanation available for a future `Why FOX2 says this` disclosure.
- Gentle reentry begins after four calendar days without a completed Fat Use
  Score. Preserve the baseline and history, welcome the person back without
  stating how many days were missed, and ask only for one new measurement.
- Do not add a separate average value beneath the chart.
- Without a baseline or active change, keep the chart useful: show the recent
  pattern without a baseline line or attributed result, omit `What you’ve
  learned`, and offer one `Set up a baseline` prompt below the chart.
- Baseline setup is optional and always has an explicit `Cancel setup` path
  back to the unchanged Progress view. Baseline choices use round radio
  markers; they must not collapse into line-shaped bullets.
- If one baseline choice is labeled `Recommended`, all three choices remain
  visible together. Present them as one compact grouped list rather than large
  standalone cards or a hidden alternatives disclosure.
- A quiet `Program options` link beneath the chart opens a compact view of the
  current baseline and action, each with one `Change` control. Measuring a new
  baseline is not a top-level program option; it remains nested inside the
  baseline-change flow.
- `What you’ve learned` uses phone-readable stacked text: a large change name
  and date line followed by a clear result sentence. Do not compress these
  fields into tiny side-by-side columns.
- Do not introduce additional graphs, score-tier colors, or alternate visual
  objects in Progress.

The firmware may use multiple colors for its compact on-device ring tiers and
NOW scale. Those device-specific tier colors must not be carried into the web
Progress ring or daily bars.
