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

(function firstResultReportsItsBaselineComparison(){
  const message=copy.progress({completedDays:days([85]),baseline:75,action:'Zepbound 0.25 mg'});
  assert.equal(message.state,'first-up-action');
  assert.equal(message.headline,'It’s only been one completed day, but since starting Zepbound 0.25 mg, your Fat Use Score is already 13% higher.');
  assert.deepStrictEqual(message.hero,{arrow:'↑',value:'13%',label:'ABOVE BASELINE',accessibleLabel:'13% above baseline'});
})();

(function gentleReentryStartsOnDayFour(){
  const completed=[{date:'2026-10-25',score:85}];
  const dayThree=copy.progress({completedDays:completed,asOfDate:'2026-10-28'});
  assert.equal(dayThree.state,'first-result');
  const dayFour=copy.progress({completedDays:completed,asOfDate:'2026-10-29'});
  assert.equal(dayFour.state,'reentry');
  assert.equal(dayFour.headline,'Welcome back. One measurement today is enough to pick up where you left off.');
  assert.equal(dayFour.metric.gapDays,4);
  const synced=copy.progress({completedDays:completed,today:{date:'2026-10-29',score:62},asOfDate:'2026-10-29'});
  assert.equal(synced.state,'first-result');
  assert.equal(synced.headline,'Your first completed Fat Use Score is 85.');
  assert.ok(!synced.headline.includes('Welcome back'),'the re-entry prompt should end as soon as today’s measurement is synced');
})();

(function firstResultWithActiveDayUsesOnlyTheCompletedBaselineComparison(){
  const message=copy.progress({completedDays:days([85]),today:{date:'2026-10-21',score:62},baseline:75,action:'Zepbound 0.25 mg'});
  assert.equal(message.state,'first-up-action');
  assert.equal(message.headline,'It’s only been one completed day, but since starting Zepbound 0.25 mg, your Fat Use Score is already 13% higher.');
  assert.ok(!message.headline.includes('62'),'the headline should acknowledge today without repeating its provisional value');
  assert.ok(message.evidence.includes('unfinished Score is not included'));
})();

(function firstLowerResultNamesTheBaseline(){
  const message=copy.progress({completedDays:days([65]),baseline:75,action:'Walk after dinner'});
  assert.equal(message.state,'first-down-action');
  assert.equal(message.headline,'It’s only been one completed day, but since starting Walk after dinner, your Fat Use Score is 13% lower than baseline.');
  assert.equal(message.hero.value,'13%');
})();

(function firstStableResultStillReportsThePercentage(){
  const message=copy.progress({completedDays:days([76]),baseline:75,action:'Walk after dinner'});
  assert.equal(message.state,'first-stable-action');
  assert.equal(message.headline,'It’s only been one completed day, but since starting Walk after dinner, your Fat Use Score is within 1% of baseline.');
})();

(function earlyActionUsesCompletedAverageAndExcludesToday(){
  const message=copy.progress({completedDays:days([85,96]),today:{score:10},baseline:75,action:'Zepbound 0.25 mg'});
  assert.equal(message.state,'early-up-action');
  assert.equal(message.metric.percent,21);
  assert.equal(message.metric.basis,'completed-average-vs-baseline');
  assert.equal(message.headline,'It’s only been a few days, but since starting Zepbound 0.25 mg, your Fat Use Score is already higher.');
  assert.deepStrictEqual(message.hero,{arrow:'↑',value:'21%',label:'ABOVE BASELINE',accessibleLabel:'21% above baseline'});
  assert.ok(message.evidence.includes('unfinished Score is not included'));
})();

(function earlyLowerActionDoesNotRepeatTheProvisionalQualifier(){
  const message=copy.progress({completedDays:days([65,68]),baseline:75,action:'Walk after dinner'});
  assert.equal(message.state,'early-down-action');
  assert.equal(message.headline,'It’s still early, but since starting Walk after dinner, your Fat Use Score is lower than baseline.');
  assert.ok(!message.headline.includes('so far'));
})();

(function establishedLowerActionNamesTheBaseline(){
  const message=copy.progress({completedDays:days([66,65,64,63]),baseline:75,action:'Walk after dinner'});
  assert.equal(message.state,'established-down-action');
  assert.equal(message.headline,'Your Fat Use Score is averaging lower than baseline since starting Walk after dinner.');
})();

(function smallChangesStayNeutral(){
  const message=copy.progress({completedDays:days([75,77]),baseline:75,action:'Walk after dinner'});
  assert.equal(message.direction,'stable');
  assert.ok(message.headline.includes('No clear shift yet'));
  assert.equal(message.hero.value,'1%');
  assert.equal(message.hero.arrow,'↔');
  const unchanged=copy.progress({completedDays:days([75,75,75,75]),baseline:75,action:'Walk after dinner'});
  assert.equal(unchanged.hero.value,'0%');
  assert.ok(unchanged.headline.includes('No clear shift yet'));
})();

(function establishedActionUsesTheSameMetric(){
  const message=copy.progress({completedDays:days([90,96,102,108]),baseline:75,action:'Zepbound 0.25 mg'});
  assert.equal(message.state,'established-up-action');
  assert.equal(message.metric.percent,32);
  assert.equal(message.headline,'Great—your Fat Use Score is averaging higher since starting Zepbound 0.25 mg.');
  assert.equal(message.hero.value,'32%');
  assert.equal(message.cta.action,'review-change');
})();

(function noBaselineUsesPersonalHistoryWithoutClaimingCausation(){
  const early=copy.progress({completedDays:days([80,100])});
  assert.equal(early.metric.basis,'latest-vs-first');
  assert.ok(early.headline.includes('higher than your first completed Score'));
  assert.equal(early.hero.value,'25%');
  const established=copy.progress({completedDays:days([70,74,90,94])});
  assert.equal(established.metric.basis,'recent-average-vs-earlier-average');
  assert.equal(established.metric.percent,28);
  assert.ok(established.evidence.includes('recent completed Fat Use Scores'));
})();

console.log('copy generator tests passed');
