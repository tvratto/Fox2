const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const engine=require('./state-engine.js');

const context={
  console,Fox2StateEngine:engine,window:{},document:{},
  URLSearchParams,URL,Blob,setTimeout
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(__dirname+'/analysis.js','utf8'),context);

(function recommendsARepeatedTaggedResponse(){
  const dates=['2026-01-05','2026-01-06','2026-01-07','2026-01-08','2026-01-09','2026-01-10','2026-01-11'];
  const history={
    days:dates.map((date,index)=>({date,score:70+index*3})),
    points:dates.slice(0,5).flatMap(date=>[
      {date,minute:400,value:2},
      {date,minute:520,value:4.5}
    ])
  };
  const tags=dates.slice(0,5).map(date=>({
    day_date:date,
    events:[{icon:'🚶',name:'Walk',minute:420}],
    tray_tags:['🚶']
  }));
  const insight=context.buildTagInsight(tags,history);
  assert.equal(insight.question,'What gets my fat use moving?');
  assert.ok(insight.answer.includes('5 of 5'));
  assert.ok(insight.answer.includes('typical increase was 2.5 levels'));
})();

(function separatesImmediateFromSustainedEffects(){
  const dates=Array.from({length:12},(_,index)=>'2026-02-'+String(index+1).padStart(2,'0'));
  const runDates=dates.slice(0,5);
  const walkDates=dates.slice(5,10);
  const history={
    days:dates.map(date=>({date,score:walkDates.includes(date)?120:80})),
    points:runDates.flatMap(date=>[
      {date,minute:400,value:2},
      {date,minute:520,value:4}
    ])
  };
  const tags=runDates.map(date=>({day_date:date,events:[{icon:'🏃',name:'Run',minute:420}],tray_tags:['🏃']}))
    .concat(walkDates.map(date=>({day_date:date,events:[],tray_tags:['🚶']})));
  const insights=context.buildTagInsights(tags,history);
  assert.equal(insights.length,2);
  assert.equal(insights[0].question,'What gets my fat use moving?');
  assert.ok(insights[0].answer.includes('🏃 Run'));
  assert.equal(insights[1].question,'What appears to help it last?');
  assert.ok(insights[1].answer.includes('🚶 Walk'));
})();

(function promptsForAnExperimentWithoutTags(){
  const insights=context.buildTagInsights([], {days:[],points:[]});
  assert.equal(insights.length,1);
  assert.equal(insights[0].question,'What should I try next?');
  assert.ok(insights[0].answer.includes('tag it'));
})();

(function preservesAlreadyCorrectScoresAtTheDateFixBoundary(){
  const corrected=context.fox2CorrectedScores([
    {day_date:'2026-09-27',auc_score:28},
    {day_date:'2026-09-28',auc_score:63},
    {day_date:'2026-09-29',auc_score:66}
  ]);
  assert.deepEqual(
    corrected.map(row=>({date:row.day_date,score:row.auc_score})),
    [{date:'2026-09-28',score:63},{date:'2026-09-29',score:66}]
  );
  const week=engine.buildWeekToDate(
    corrected.map(row=>({date:row.day_date,score:row.auc_score,movement:'steady'})),
    {referenceDate:'2026-09-30'}
  );
  assert.equal(week.current.metrics.medianScore,64.5);
})();

(function avoidsInternalLanguageInFirstDayCopy(){
  const sample=[
    {date:'2026-01-05',score:90,movement:'responsive',range:4,responseAmplitude:3},
    {date:'2026-01-12',score:60,movement:'responsive',range:3,responseAmplitude:3}
  ];
  const wtd=engine.buildWeekToDate(sample,{referenceDate:'2026-01-13'});
  const copy=context.weekToDateCopy(wtd,null);
  assert.equal(copy.question,'Am I still making progress?');
  assert.ok(copy.summary.includes('60'));
  assert.ok(copy.summary.includes('90'));
  assert.ok(copy.summary.includes('something useful to build on'));
  assert.ok(!/quiet|responsive|pattern/i.test(copy.title+' '+copy.summary+' '+copy.answer));
})();

(function ordersCurrentAndCompletedWeeksForComparison(){
  function state(start,end,score,coverage){
    return {
      startDate:start,endDate:end,coverage:coverage,classifiableDays:2,level:'moderate',
      metrics:{medianScore:score,responsiveDays:1,bandDays:{low:0,moderate:2,higher:0,strong:0}},
      transition:{kind:'same_state',scoreDirection:'stable',responseDirection:'stable'}
    };
  }
  const current=state('2026-09-28','2026-09-29',64.5,'provisional');
  const html=context.weeklyStateHistoryHtml([
    state('2026-09-14','2026-09-20',80,'limited'),
    state('2026-09-21','2026-09-27',110,'sufficient')
  ],{
    current,throughDate:'2026-09-29',
    comparison:{scoreDirection:'falling'}
  });
  assert.ok(html.includes('Compare your weeks'));
  assert.ok(html.includes('Incomplete'));
  assert.ok(html.includes('64.5'));
  assert.ok(html.indexOf('09-28 – 09-29')<html.indexOf('09-21 – 09-27'));
  assert.ok(html.indexOf('09-21 – 09-27')<html.indexOf('09-14 – 09-20'));
  assert.ok(!html.includes('1 days'));
})();

(function leadsWithComparisonThenDataThenEncouragement(){
  const sample=[
    {date:'2026-09-21',score:94,movement:'responsive',range:4,responseAmplitude:4},
    {date:'2026-09-22',score:126,movement:'steady',range:2,responseAmplitude:0},
    {date:'2026-09-28',score:63,movement:'steady',range:0,responseAmplitude:0},
    {date:'2026-09-29',score:66,movement:'steady',range:3,responseAmplitude:0}
  ];
  const week=engine.buildWeekToDate(sample,{referenceDate:'2026-09-30'});
  const copy=context.weekToDateCopy(week,null);
  assert.equal(week.trajectory,'fading');
  assert.equal(copy.title,'You’re behind last week—but your fat-use signal is still moving.');
  assert.ok(copy.summary.includes('64.5'));
  assert.ok(copy.summary.includes('110'));
  assert.ok(copy.summary.includes('something useful to build on'));
  assert.ok(!copy.title.includes('something encouraging here'));
})();

console.log('analysis tests passed');
