const assert=require('assert');
const copy=require('./copy-generator.js');

function days(scores){
  return scores.map((score,index)=>({date:`2026-10-${String(index+20).padStart(2,'0')}`,score}));
}

(function emptyAndAccumulatingStates(){
  const empty=copy.generateCopy('progress',{});
  assert.equal(empty.state,'empty');
  assert.ok(empty.headline.includes('first pattern'));
  const today=copy.progress({today:{score:62}});
  assert.equal(today.state,'accumulating');
  assert.equal(today.headline,'Today’s Fat Use Score is 62 so far.');
})();

(function firstResultDoesNotOverclaim(){
  const message=copy.progress({completedDays:days([85]),baseline:75,action:'Zepbound 0.25 mg'});
  assert.equal(message.state,'first-result');
  assert.equal(message.headline,'Your first completed Fat Use Score is 85.');
  assert.ok(message.detail.includes('first result since starting Zepbound 0.25 mg'));
})();

(function earlyActionUsesCompletedAverageAndExcludesToday(){
  const message=copy.progress({completedDays:days([85,96]),today:{score:10},baseline:75,action:'Zepbound 0.25 mg'});
  assert.equal(message.state,'early-up-action');
  assert.equal(message.metric.percent,21);
  assert.equal(message.metric.basis,'completed-average-vs-baseline');
  assert.equal(message.headline,'It’s only been a few days, but since starting Zepbound 0.25 mg, your Fat Use Score is already 21% higher.');
  assert.ok(message.evidence.includes('unfinished Score is not included'));
})();

(function smallChangesStayNeutral(){
  const message=copy.progress({completedDays:days([75,77]),baseline:75,action:'Walk after dinner'});
  assert.equal(message.direction,'stable');
  assert.ok(message.headline.includes('No clear shift yet'));
  assert.ok(message.headline.includes('within 1%'));
  const unchanged=copy.progress({completedDays:days([75,75,75,75]),baseline:75,action:'Walk after dinner'});
  assert.ok(unchanged.headline.includes('right at baseline'));
  assert.ok(!unchanged.headline.includes('within 0%'));
})();

(function establishedActionUsesTheSameMetric(){
  const message=copy.progress({completedDays:days([90,96,102,108]),baseline:75,action:'Zepbound 0.25 mg'});
  assert.equal(message.state,'established-up-action');
  assert.equal(message.metric.percent,32);
  assert.equal(message.headline,'Great—since starting Zepbound 0.25 mg, your Fat Use Score has averaged 32% higher than your baseline.');
  assert.equal(message.cta.action,'review-change');
})();

(function noBaselineUsesPersonalHistoryWithoutClaimingCausation(){
  const early=copy.progress({completedDays:days([80,100])});
  assert.equal(early.metric.basis,'latest-vs-first');
  assert.ok(early.headline.includes('25% higher than your first completed Score'));
  const established=copy.progress({completedDays:days([70,74,90,94])});
  assert.equal(established.metric.basis,'recent-average-vs-earlier-average');
  assert.equal(established.metric.percent,28);
  assert.ok(established.evidence.includes('recent completed Fat Use Scores'));
})();

console.log('copy generator tests passed');
