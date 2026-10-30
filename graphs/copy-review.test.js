const assert=require('assert');
const fs=require('fs');

const source=fs.readFileSync(__dirname+'/copy-review.html','utf8');

assert.ok(source.includes('<meta name="robots" content="noindex,nofollow">'),
  'the internal copy review should stay out of search results');
assert.ok(source.includes('copy-generator.js?v=20261029-02')&&source.includes("Fox2CopyGenerator.generateCopy('progress',row.input)"),
  'the review must exercise the same generator used by live Progress');
[
  'empty','accumulating','first','early-up','early-stable','early-down',
  'established-up','established-stable','established-down','personal-early',
  'personal-established','day-three','reentry','reentry-synced'
].forEach(id=>assert.ok(source.includes(`id:'${id}'`),`copy review should include ${id}`));
assert.ok(source.includes('reentryAfterDays:4')&&source.includes("date:'2026-10-25'")&&source.includes("asOfDate:'2026-10-29'"),
  'the review should show the four-day reentry boundary');
assert.ok(source.includes("scoreDays([85,96],'2026-10-27')"),
  'the early-result fixture should remain below the reentry boundary');
assert.ok(!source.includes('href="index.html"')&&!source.includes('href="/graphs/"'),
  'the internal review must not add customer-facing navigation');

console.log('copy review tests passed');
