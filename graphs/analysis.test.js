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

(function anchorsAnalysisToLastMeasurementInsteadOfWallClock(){
  const history=context.buildHistoricalAnalysis([
    {reading_ts:'2025-04-10T08:00:00Z',ppm:2},
    {reading_ts:'2025-04-10T14:00:00Z',ppm:3},
    {reading_ts:'2025-04-10T20:00:00Z',ppm:2},
    {reading_ts:'2025-04-11T09:00:00Z',ppm:3}
  ],[
    {day_date:'2025-04-09',auc_score:60},
    {day_date:'2025-04-10',auc_score:70}
  ]);
  assert.equal(history.activeDate,'2025-04-11');
  assert.ok(history.days.every(day=>day.date<'2025-04-11'));
})();

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
  assert.equal(insights[0].question,'What should I test next?');
  assert.ok(insights[0].answer.includes('tag it each time'));
  assert.ok(insights[0].answer.includes('repeated examples'));
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
  const priorWeek={classifiableDays:1,metrics:{meanScore:90}};
  const copy=context.weekToDateCopy(wtd,null,sample,priorWeek);
  assert.equal(copy.question,'What should I watch next?');
  assert.ok(copy.summary.includes('60'));
  assert.ok(copy.summary.includes('90'));
  assert.ok(copy.summary.includes('one day does not define the week')||copy.title.includes('one day does not define the week'));
  assert.ok(!/quiet|responsive|pattern/i.test(copy.title+' '+copy.summary+' '+copy.answer));
})();

(function comparesOneDayWithTheDayBeforeAndPreviousWeekAverage(){
  const allDays=[
    {date:'2026-09-21',score:77,movement:'steady',range:1},
    {date:'2026-09-22',score:107,movement:'responsive',range:4},
    {date:'2026-09-23',score:118,movement:'steady',range:1},
    {date:'2026-09-24',score:91,movement:'steady',range:1},
    {date:'2026-09-25',score:105,movement:'steady',range:1},
    {date:'2026-09-27',score:72,movement:'steady',range:1},
    {date:'2026-09-29',score:94,movement:'steady',range:1}
  ];
  const week=engine.buildWeekToDate(allDays,{referenceDate:'2026-09-30'});
  const previousWeek={classifiableDays:6,metrics:{meanScore:95}};
  const copy=context.weekToDateCopy(week,null,allDays,previousWeek);
  const evidence=context.weekToDateEvidenceHtml(week,null,allDays,previousWeek);
  assert.equal(copy.title,'Yesterday was right in line with last week.');
  assert.ok(copy.summary.includes('Daily Fuel Score was 94'));
  assert.ok(copy.summary.includes('no classifiable score for the day before'));
  assert.ok(copy.summary.includes('averaged 95 across 6 days with saved scores'));
  assert.ok(evidence.includes('Yesterday’s score'));
  assert.ok(evidence.includes('Fat use yesterday</div><div class="analysis-kpi-value">Balanced'));
  assert.ok(evidence.includes('No comparable day'));
  assert.ok(evidence.includes('95 · 6 days'));
  assert.ok(!evidence.includes('Typical daily score'));
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
  const states=[
    state('2026-09-14','2026-09-20',80,'limited'),
    state('2026-09-21','2026-09-27',110,'sufficient')
  ];
  const scoreDays=[
    {date:'2026-09-14',score:80},{date:'2026-09-15',score:80},
    {date:'2026-09-21',score:110},{date:'2026-09-22',score:110},
    {date:'2026-09-28',score:63},{date:'2026-09-29',score:66}
  ];
  const html=context.weeklyStateHistoryHtml(states,{
    current,throughDate:'2026-09-29',
    comparison:{scoreDirection:'falling'}
  },scoreDays);
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
  const copy=context.weekToDateCopy(week,null,sample,null);
  assert.equal(week.trajectory,'fading');
  assert.equal(copy.title,'You’re behind last week—but your fat-use signal is still moving.');
  assert.ok(copy.summary.includes('64.5'));
  assert.ok(copy.summary.includes('110'));
  assert.ok(copy.summary.includes('something useful to build on'));
  assert.ok(!copy.title.includes('something encouraging here'));
})();

(function buildsEightWeekTrendWithRangeAndResponsiveness(){
  const scores=[
    {date:'2026-09-21',score:90},{date:'2026-09-22',score:110},
    {date:'2026-09-28',score:60},{date:'2026-09-29',score:100},{date:'2026-09-30',score:80}
  ];
  const classified=[
    {date:'2026-09-21',movement:'responsive'},{date:'2026-09-22',movement:'responsive'},
    {date:'2026-09-28',movement:'responsive'},{date:'2026-09-29',movement:'steady'}
  ];
  const week={startDate:'2026-09-28',throughDate:'2026-09-30'};
  const series=context.weeklyTrendSeries(scores,classified,week,8);
  assert.equal(series.length,8);
  assert.equal(series[0].startDate,'2026-08-10');
  assert.equal(series[7].mean,80);
  assert.equal(series[7].low,60);
  assert.equal(series[7].high,100);
  assert.equal(series[7].responseRate,.5);
  assert.equal(series[7].current,true);
  const html=context.weeklyTrendHtml(scores,classified,week);
  assert.ok(html.includes('Your last 8 weeks'));
  assert.ok(html.includes('Whiskers show its lowest and highest'));
  assert.ok(html.includes('average 80, range 60–100, 1 of 2 assessable days responsive · incomplete week'));
  assert.ok(html.includes('no completed scores'));
})();

(function avoidsRepeatingSummarySections(){
  const source=context.renderHistoricalAnalysis.toString();
  assert.ok(!source.includes('weekToDateEvidenceHtml('));
  assert.ok(!source.includes('Why FOX2 says this'));
  assert.ok(!source.includes('How your fat use has changed'));
  assert.ok(!source.includes('addInsight(weekCopy.question'));
  assert.ok(source.includes('weeklyTrendHtml(scoreDays,all,weekToDate)'));
  assert.ok(!source.includes('recentScoreSummaryHtml'));
})();

console.log('analysis tests passed');
