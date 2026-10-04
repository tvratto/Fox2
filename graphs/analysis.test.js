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
  assert.equal(insight.question,'What may be helping?');
  assert.ok(insight.headline.includes('may be helping your body use more fat for energy'));
  assert.ok(insight.answer.includes('several recent times you tagged Walk'));
  assert.ok(insight.detail.includes('5 of 5'));
  assert.ok(insight.detail.includes('your results suggested your body was using more fat for energy afterward'));
  assert.ok(!insight.detail.includes('Fat Zone'));
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
  assert.equal(insights[0].question,'What may be helping?');
  assert.ok(insights[0].headline.includes('🏃 Run'));
  assert.equal(insights[1].question,'What may be helping?');
  assert.ok(insights[1].headline.includes('🚶 Walk'));
})();

(function keepsInconclusiveTagsSilent(){
  const insights=context.buildTagInsights([], {days:[],points:[]});
  assert.equal(insights.length,0);
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
  assert.ok(copy.title.includes('below last week'));
  assert.ok(copy.title.includes('one day does not define the week'));
  assert.ok(!/60|90/.test(copy.summary));
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
  assert.equal(copy.title,'Yesterday was close to your usual result last week.');
  assert.ok(copy.summary.includes('steady result to build on'));
  assert.ok(!copy.summary.includes('94'));
  assert.ok(evidence.includes('Yesterday’s score'));
  assert.ok(evidence.includes('Daily Fuel Score range</div><div class="analysis-kpi-value">Balanced'));
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
  assert.equal(copy.title,'This week is a little behind last week.');
  assert.ok(copy.summary.includes('shift toward fat for energy'));
  assert.ok(copy.summary.includes('choose one safe part to repeat'));
  assert.ok(!/64\.5|110/.test(copy.summary));
})();

(function describesALateWeekRecoveryWithoutSayingItIsStarting(){
  const sample=[40,42,72,85].map((score,index)=>({
    date:'2026-01-'+String(12+index).padStart(2,'0'),score,
    movement:index===3?'responsive':'steady',range:index===3?3:1,responseAmplitude:index===3?3:0
  }));
  const week=engine.buildWeekToDate(sample,{referenceDate:'2026-01-16'});
  assert.equal(week.trajectory,'recovering');
  const copy=context.weekToDateCopy(week,null,sample,null);
  assert.equal(copy.title,'This week got stronger after a slower start.');
  assert.ok(!/starting to turn around/i.test(copy.title+' '+copy.summary+' '+copy.answer));
  const evidence=context.analysisWeekEvidence(week);
  assert.ok(evidence.detail.includes('latest two saved Daily Fuel Scores'));
  assert.ok(evidence.detail.includes('41 earlier in the week'));
  assert.ok(evidence.detail.includes('78.5 on the latest two days'));
  assert.ok(evidence.visual.includes('Daily Fuel Scores this week, comparing the earlier days with the latest two days'));
  assert.ok(evidence.visual.includes('◯ Earlier days'));
  assert.ok(evidence.visual.includes('◯ Latest two days'));
  assert.ok(evidence.visual.includes('r="6"'));
  assert.ok(evidence.visual.includes('#FFD23C'));
  assert.ok(!evidence.visual.includes('last 14 days'));
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
  assert.equal(series[7].consecutiveDayPairs,2);
  assert.equal(series[7].medianDayToDayChange,30);
  assert.equal(series[7].current,true);
  assert.equal(context.weeklyTrendSummary(series),'This week’s average is 80 so far—about 20 points below last week’s average of 100.');
  const html=context.weeklyTrendHtml(scores,classified,week);
  assert.ok(html.includes('Your last 8 weeks'));
  assert.ok(html.includes('This week’s average is 80 so far'));
  assert.ok(html.includes('Color shows how often your Fat Zone clearly went up'));
  assert.ok(html.includes('average 80, range 60–100, typical day-to-day change 30, 1 of 2 well-measured days had a clear rise and return · incomplete week'));
  assert.ok(html.includes('no completed scores'));
})();

(function separatesDayToDayMovementFromMeasurementResponsiveness(){
  const movement=context.dayToDayScoreMovement([
    {date:'2026-09-28',score:50},
    {date:'2026-09-29',score:85},
    {date:'2026-10-01',score:120}
  ],'2026-09-28','2026-10-04');
  assert.equal(movement.dayCount,3);
  assert.equal(movement.pairCount,1);
  assert.equal(movement.medianAbsoluteChange,35);
  assert.equal(movement.range,70);
  assert.equal(movement.meaningfulMoves,1);
  const insight=context.dayToDayScoreInsight(movement,null);
  assert.equal(insight.question,'Is this shift showing up on more days?');
  assert.ok(insight.answer.includes('body draws on fat for energy more often than others'));
  assert.ok(!insight.answer.toLowerCase().includes('inconsistent'));
})();

(function describesRepeatabilityAsProgress(){
  const previous=context.dayToDayScoreMovement([
    {date:'2026-09-21',score:60},{date:'2026-09-22',score:120},
    {date:'2026-09-23',score:70},{date:'2026-09-24',score:130}
  ],'2026-09-21','2026-09-27');
  const current=context.dayToDayScoreMovement([
    {date:'2026-09-28',score:105},{date:'2026-09-29',score:120},
    {date:'2026-09-30',score:115},{date:'2026-10-01',score:125}
  ],'2026-09-28','2026-10-04');
  const insight=context.dayToDayScoreInsight(current,previous);
  assert.equal(insight.question,'Is the change lasting longer?');
  assert.ok(insight.answer.includes('for more of the day'));
})();

(function buildsQuestionSpecificEvidenceCharts(){
  const withinDay=context.withinDayEvidenceSvg([
    {date:'2026-09-29',movement:'responsive',range:3,responseEpisode:{baseline:2}}
  ],[
    {date:'2026-09-29',minute:480,value:2},
    {date:'2026-09-29',minute:780,value:5},
    {date:'2026-09-29',minute:1140,value:2.5}
  ]);
  assert.ok(withinDay.includes('Fat Zone measurements across 2026-09-29'));
  assert.ok(withinDay.includes('8:00am'));
  assert.ok(withinDay.includes('7:00pm'));
  assert.ok(withinDay.includes('Your usual level'));
  assert.ok(withinDay.includes('Your Fat Zone went up'));
  assert.ok(withinDay.includes('rose above your usual level'));
  assert.ok(withinDay.includes('One-day example · Sep 29'));
  assert.ok(withinDay.includes('<path'));
  assert.ok(!withinDay.includes('analysis-moment-orb'));

  const daily=context.dailyScoreEvidenceSvg([
    {date:'2026-09-28',score:70},{date:'2026-09-29',score:93}
  ],'Daily Fuel Scores this week');
  assert.ok(daily.includes('Daily Fuel Score 70'));
  assert.ok(daily.includes('Daily Fuel Score 93'));

  const tagged=context.tagEvidenceHtml({evidence:{
    kind:'immediate',rate:.6,stat:{name:'Run',rises:3,eligible:5}
  }});
  assert.ok(tagged.includes('width:60%'));
  assert.ok(tagged.includes('3 of 5'));
  assert.ok(tagged.includes('Run tags followed by more fat use'));
  assert.equal(context.tagInsightTimeframe({evidence:{kind:'immediate',stat:{eligible:5}}}),'Repeated choice · 5 occasions');
  assert.equal(context.tagInsightTimeframe({evidence:{kind:'same_day',count:6}}),'Repeated choice · 6 days');
})();

(function avoidsRepeatingSummarySections(){
  const source=context.renderHistoricalAnalysis.toString();
  assert.ok(!source.includes('weekToDateEvidenceHtml('));
  assert.ok(!source.includes('How your fat use has changed'));
  assert.ok(!source.includes('addInsight(weekCopy.question'));
  assert.ok(!source.includes('weeklyTrendHtml(scoreDays,all,weekToDate)'));
  assert.ok(!source.includes('Your last 8 weeks'));
  assert.ok(!source.includes('weeklyStateHistoryHtml('));
  assert.ok(!source.includes('recentScoreSummaryHtml'));
  assert.ok(source.includes("<h2 class=\"analysis-major-title\">'+analysisEscape(weekCopy.title)+'</h2>"));
  assert.ok(source.includes("<p class=\"analysis-summary\">'+weekCopy.summary+'</p>"));
  assert.ok(!source.includes("weekCopy.title+' '+progressInsight.answer"));
  assert.ok(!source.includes('tagInsights.slice('));
  assert.ok(!source.includes('How is this week going?</h2>'));
  assert.ok(!source.includes('Am I making progress overall?'));
  assert.ok(!source.includes('What stood out recently?'));
  assert.ok(source.includes('analysisStallInsight(scoreDays,history,history.activeDate)'));
  assert.ok(source.includes("shell.innerHTML=positionHtml+openingHtml"));
  assert.ok(source.indexOf('+helpingBlock')<source.indexOf('var prioritizedStall='));
  assert.ok(!source.includes('standaloneHelpingHtml'));
  assert.ok(source.includes('analysisSelectQuestions(['));
  assert.ok(source.includes('analysisQuestionCardHtml(insight'));
  assert.ok(source.includes("document.getElementById('history-score-trend')"));
  assert.ok(source.includes('historyTrend.innerHTML=scoreDays.length'));
  assert.ok(source.indexOf('Daily Fuel Score over time')<source.indexOf('var helpingBlock='));
})();

(function selectsOnlyTheTwoMostRelevantSupportedQuestions(){
  const selected=context.analysisSelectQuestions([
    {question:'Low priority',priority:10},
    {question:'Safety',priority:100},
    null,
    {question:'Progress detail',priority:60}
  ],2);
  assert.deepEqual(selected.map(item=>item.question),['Safety','Progress detail']);
})();

(function presentsTheConclusionInsteadOfTheInternalQuestion(){
  const html=context.analysisQuestionCardHtml({
    question:'Could I be stalled?',
    headline:'Your recent progress may have leveled off.',
    answer:'Your recent results have stayed about the same.',
    detail:'Four recent days were compared.',tone:'is-watch',icon:'?'
  },'');
  assert.ok(html.includes('Your recent progress may have leveled off.'));
  assert.ok(!html.includes('Could I be stalled?'));
})();

(function surfacesAProtectiveQuestionForHighSteadyResults(){
  const insight=context.analysisOverextendedInsight({
    trajectory:'possibly_overextended',
    current:{classifiableDays:3,days:[
      {date:'2026-09-28',score:190},{date:'2026-09-29',score:195},{date:'2026-09-30',score:200}
    ]}
  },null);
  assert.equal(insight.question,'Could I be pushing too hard?');
  assert.ok(insight.answer.includes('eating enough'));
  assert.equal(insight.priority,100);
})();

(function recognizesAChangeThatLastedAcrossCompletedWeeks(){
  function week(start,end,median){
    return {startDate:start,endDate:end,coverage:'sufficient',metrics:{medianScore:median},historical:{}};
  }
  const insight=context.analysisLastingChangeInsight([
    week('2026-09-07','2026-09-13',80),
    week('2026-09-14','2026-09-20',92),
    week('2026-09-21','2026-09-27',96)
  ]);
  assert.equal(insight.question,'Is the change lasting?');
  assert.ok(insight.answer.includes('more than one completed week'));
  assert.ok(insight.visual.includes('latest three completed weeks'));
})();

(function onlyCallsOutARecentDayWhenItIsUnusualForThatPerson(){
  const earlier=Array.from({length:12},(_,index)=>({date:'2026-09-'+String(index+1).padStart(2,'0'),score:70+(index%4)*3}));
  const insight=context.analysisStandoutQuestion(earlier.concat([
    {date:'2026-09-25',score:82},
    {date:'2026-09-28',score:135}
  ]),'2026-09-30');
  assert.equal(insight.question,'Did I have an unusually strong day?');
  assert.ok(insight.headline.includes('Last Monday was an unusually strong day'));
  assert.ok(insight.detail.includes('higher than at least 90%'));

  const ordinary=context.analysisStandoutQuestion(earlier.concat([{date:'2026-09-28',score:80}]),'2026-09-30');
  assert.equal(ordinary,null);
})();

(function pointsAStandoutDayBackToTheRelevantEarlierWindow(){
  const insight={date:'2026-09-28',answer:'generic',detail:'Monday was unusually strong.'};
  const points=[];
  ['2026-09-21','2026-09-22','2026-09-23','2026-09-24'].forEach(date=>{
    points.push({date,minute:480,value:2},{date,minute:840,value:2},{date,minute:1140,value:2.5});
  });
  points.push(
    {date:'2026-09-28',minute:480,value:2},
    {date:'2026-09-28',minute:840,value:4},
    {date:'2026-09-28',minute:1140,value:4.5}
  );
  const contextual=context.analysisStandoutDayContext(insight,{points},'2026-09-30');
  assert.ok(contextual.answer.includes('went up Monday afternoon and stayed higher that evening'));
  assert.ok(contextual.answer.includes('Sunday evening and Monday morning'));
  assert.ok(contextual.answer.includes('what was different?'));
  assert.ok(contextual.detail.includes('not a proven cause'));
})();

(function placesTheLongTermScoreChartInHistory(){
  const pageSource=fs.readFileSync(__dirname+'/index.html','utf8');
  const historyCanvas=pageSource.indexOf('id="card-fuel"');
  const historyTrend=pageSource.indexOf('id="history-score-trend"');
  const analysisShell=pageSource.indexOf('id="analysis-shell"');
  assert.ok(historyCanvas>=0&&historyTrend>historyCanvas&&historyTrend<analysisShell);
})();

(function raisesAStallQuestionOnlyForAFlatOrFallingSub120Week(){
  const scores=[92,96,94,91,93,90].map((score,index)=>({date:'2026-09-'+String(23+index).padStart(2,'0'),score}));
  const history={days:[
    {date:'2026-09-24',movement:'responsive',range:3},
    {date:'2026-09-26',movement:'responsive',range:4},
    {date:'2026-09-28',movement:'steady',range:1}
  ],points:[]};
  const insight=context.analysisStallInsight(scores,history,'2026-09-30');
  assert.equal(insight.question,'Could I be stalled?');
  assert.ok(insight.answer.includes('If you’re trying to reduce body fat'));
  assert.ok(insight.answer.includes('daily results have stayed about the same'));
  assert.ok(insight.detail.includes('Fat Zone still goes up and down'));
  assert.ok(insight.detail.includes('Days without a saved score were left out'));
  assert.ok(!insight.detail.includes('averaged'));

  const improving=[70,74,79,86,94].map((score,index)=>({date:'2026-09-'+String(24+index).padStart(2,'0'),score}));
  assert.equal(context.analysisStallInsight(improving,{days:[],points:[]},'2026-09-30'),null);
  const higher=[126,132,129,135].map((score,index)=>({date:'2026-09-'+String(25+index).padStart(2,'0'),score}));
  assert.equal(context.analysisStallInsight(higher,{days:[],points:[]},'2026-09-30'),null);
})();

(function findsThePartOfTheDayWithTheMostRoomToImprove(){
  const points=[];
  ['2026-09-24','2026-09-25','2026-09-26','2026-09-27'].forEach(function(date){
    points.push({date,minute:480,value:2});
    points.push({date,minute:840,value:4});
    points.push({date,minute:1140,value:5});
  });
  const opportunity=context.analysisDaypartOpportunity({points},'2026-09-30');
  assert.equal(opportunity.question,'What could I try?');
  assert.equal(opportunity.headline,'Your morning is your biggest opportunity.');
  assert.equal(opportunity.headline,'Your morning is your biggest opportunity.');
  assert.ok(opportunity.answer.includes('Fat Zone often goes up in the evening'));
  assert.ok(opportunity.answer.includes('afternoon or evening before'));
  assert.ok(opportunity.detail.includes('The morning was the lowest part'));
  assert.ok(opportunity.detail.includes('evening was the highest'));
})();

(function pointsAnAfternoonOpportunityBackToEarlierChoices(){
  const points=[];
  ['2026-09-24','2026-09-25','2026-09-26','2026-09-27'].forEach(function(date){
    points.push({date,minute:480,value:5});
    points.push({date,minute:840,value:2});
    points.push({date,minute:1140,value:5});
  });
  const opportunity=context.analysisDaypartOpportunity({points},'2026-09-30');
  assert.equal(opportunity.headline,'Your midday dip is your clearest opportunity.');
  assert.ok(opportunity.answer.includes('night before or that morning'));
  assert.ok(!opportunity.answer.includes('midday meal'));
  assert.ok(opportunity.visual.includes('A recent day that shows this pattern'));
  assert.ok(opportunity.visual.includes('Midday dip'));
  assert.ok(opportunity.visual.includes('This is one real day from your measurements'));
  assert.ok(!opportunity.visual.includes('analysis-action-flow'));
})();

(function usesAnActualDayForTheDaypartEvidenceGraphic(){
  const points=[
    {date:'2026-09-25',minute:480,value:4},
    {date:'2026-09-25',minute:780,value:2},
    {date:'2026-09-25',minute:1140,value:5},
    {date:'2026-09-26',minute:480,value:5},
    {date:'2026-09-26',minute:780,value:4},
    {date:'2026-09-26',minute:1140,value:5}
  ];
  const visual=context.analysisDaypartVisual(points,'afternoon','2026-09-30',false);
  assert.ok(visual.includes('Last Friday'));
  assert.ok(visual.includes('Fat Zone 2'));
  assert.ok(visual.includes('8am'));
  assert.ok(visual.includes('7pm'));
})();

(function keepsTheDaypartGraphicInsideWhyFox2SaysThis(){
  const source=context.renderHistoricalAnalysis.toString();
  assert.ok(source.includes("analysisWhyHtml(daypartOpportunity.detail,daypartOpportunity.visual||'')"));
  assert.ok(!source.includes("+(daypartOpportunity.visual||'')+analysisWhyHtml"));
})();

(function callsOutARecurringEveningRiseEvenWhenDaypartAveragesAreClose(){
  const points=[];
  for(let day=20;day<30;day++){
    const date='2026-09-'+day;
    points.push({date,minute:480,value:4});
    points.push({date,minute:840,value:4});
    points.push({date,minute:1140,value:day<26?5:4});
  }
  const opportunity=context.analysisDaypartOpportunity({points},'2026-09-30');
  assert.ok(opportunity.answer.includes('often goes up from afternoon to evening'));
  assert.ok(!opportunity.answer.includes('no single part of the day has a much lower average'));
  assert.ok(opportunity.detail.includes('6 of 10 comparable recent days'));
  assert.ok(opportunity.visual.includes('Evening rise'));
  assert.ok(opportunity.visual.includes('This is one real day from your measurements'));
})();

(function usesEightRecentWeeksAndOnlyResurfacesStrongOlderEvidence(){
  const windowed=context.analysisTagWindow([
    {day_date:'2026-07-01',events:[]},
    {day_date:'2026-09-20',events:[]}
  ],{days:[{date:'2026-07-01'},{date:'2026-09-20'}],points:[]},'2026-08-05','2026-09-29');
  assert.deepEqual(windowed.rows.map(row=>row.day_date),['2026-09-20']);

  const stalled=Array.from({length:14},(_,index)=>({date:'2026-09-'+String(8+index).padStart(2,'0'),score:90+(index%2)}));
  assert.equal(context.analysisExtendedStall(stalled,'2026-09-29'),true);
  assert.equal(context.analysisSupportedTagInsight([], {days:[],points:[]}),null);

  const oldDates=Array.from({length:7},(_,index)=>'2026-05-'+String(index+1).padStart(2,'0'));
  const olderTags=oldDates.map(date=>({day_date:date,events:[{icon:'🚶',name:'Walk',minute:420}]}));
  const olderHistory={
    days:oldDates.map(date=>({date,score:90})),
    points:oldDates.flatMap(date=>[
      {date,minute:400,value:2},
      {date,minute:520,value:4.5}
    ])
  };
  const historical=context.analysisHistoricalTagInsight(olderTags,olderHistory,'2026-10-01');
  assert.equal(historical.question,'What helped before?');
  assert.ok(historical.answer.includes('Earlier in your history'));
  assert.ok(historical.answer.includes('metabolism shift toward using more fat for energy'));
  assert.ok(historical.answer.includes('whether the pattern returns'));
})();

(function givesAPlainLanguageLookbackForAStandoutPeriod(){
  const days=[{
    date:'2026-09-30',movement:'responsive',
    responseEpisode:{baseline:2,peak:5,startTime:Date.parse('2026-09-30T14:00:00Z'),startMinute:840}
  }];
  const noTag=context.analysisLookbackWindow(days,[],'2026-10-01',5);
  assert.ok(noTag.guidance.includes('Yesterday afternoon stood out'));
  assert.ok(noTag.guidance.includes('Tuesday evening through Wednesday morning'));
  assert.ok(noTag.guidance.includes('Choose one safe part'));
  assert.ok(noTag.evidence.includes('Fat Zone rose from a usual level near 2 to 5'));

  const withTag=context.analysisLookbackWindow(days,[{
    day_date:'2026-09-30',events:[{icon:'🚶',name:'Walk',minute:600}]
  }],'2026-10-01',5);
  assert.ok(withTag.guidance.includes('You tagged 🚶 Walk beforehand'));
  assert.ok(withTag.guidance.includes('We don’t know yet if it helped'));

  assert.ok(context.analysisLookbackWindow(days,[],'2026-10-05',5));
  assert.equal(context.analysisLookbackWindow(days,[],'2026-10-06',5),null);
})();

(function distinguishesBalancedMaintenanceFromGettingClose(){
  const timRecent=[91,88,94,90].map((score,index)=>({date:'2026-09-'+String(15+index).padStart(2,'0'),score}));
  const timPrior=[89,93,90,92].map((score,index)=>({date:'2026-09-'+String(1+index).padStart(2,'0'),score}));
  const tim=context.analysisRecentProgressInsight(timRecent,timPrior,[],[]);
  assert.equal(tim.tier,'balanced');
  assert.ok(tim.headline.includes('steady, balanced fuel pattern'));
  assert.ok(tim.answer.includes('using fat regularly'));
  assert.ok(tim.answer.split(/[.!?]+/).filter(Boolean).length<=2);
  assert.ok(!/\b91\b|\b120\b/.test(tim.headline+' '+tim.answer));

  const maggieRecent=[103,119,128,135,104,114].map((score,index)=>({date:'2026-08-'+String(12+index).padStart(2,'0'),score}));
  const maggiePrior=[95,99,101,102].map((score,index)=>({date:'2026-07-'+String(28+index).padStart(2,'0'),score}));
  const maggie=context.analysisRecentProgressInsight(maggieRecent,maggiePrior,[],[]);
  assert.equal(maggie.tier,'balanced-near-higher');
  assert.ok(maggie.headline.includes('getting close to a higher fat-use range'));
  assert.ok(maggie.answer.includes('already reaching it on some days'));
  assert.ok(!/\b109\b|\b120\b/.test(maggie.headline+' '+maggie.answer));
  assert.ok(maggie.detail.includes('body-fat loss may become more likely'));
})();

(function explainsProgressAsMetabolicContextInsteadOfStatistics(){
  const explanation=context.analysisProgressExplanation(
    {dayCount:4,mean:82.3},
    {dayCount:7,mean:95.7},
    [{movement:'responsive'},{movement:'steady'}],
    [{movement:'steady'},{movement:'steady'}]
  );
  assert.ok(explanation.includes('using less fat for energy across the day than last week'));
  assert.ok(explanation.includes('encouraging part'));
  assert.ok(explanation.includes('metabolism is responding'));
  assert.ok(!/82\.3|95\.7|four|seven|average|saved Daily Fuel Score/i.test(explanation));
})();

(function callsOutARecentStrongerDayWithoutClaimingCause(){
  const scores=[
    {date:'2026-08-21',score:85},{date:'2026-08-22',score:150},
    {date:'2026-08-23',score:114},{date:'2026-08-24',score:95}
  ];
  const opportunity=context.analysisRecentScoreOpportunity(scores,'2026-08-26',[{
    day_date:'2026-08-22',events:[{icon:'🏃',name:'Run',minute:600}]
  }],111);
  assert.ok(opportunity.title.includes('Last Saturday'));
  assert.ok(opportunity.answer.includes('higher fat-use range'));
  assert.ok(opportunity.answer.includes('You tagged 🏃 Run'));
  assert.ok(opportunity.answer.includes('We don’t know yet if it helped'));
  assert.ok(!opportunity.answer.includes('150'));
})();

(function showsTheTierWithoutLeadingWithNumbers(){
  const insight={tier:'balanced-near-higher'};
  const html=context.analysisTierGuideHtml(insight,109,'Last 14 calendar days · Sep 18–Oct 1');
  assert.ok(html.includes('Your recent pattern is in balanced fuel use.'));
  assert.ok(html.includes('<h1 class="analysis-title">Your recent pattern is in balanced fuel use.</h1>'));
  assert.ok(html.indexOf('Last 14 calendar days')<html.indexOf('Your recent pattern is in balanced fuel use.'));
  assert.ok(!html.includes('Where am I now?'));
  assert.ok(html.includes('close to the higher range'));
  assert.ok(html.includes('Close to higher'));
  assert.ok(html.includes('analysis-tier-definition balanced')||html.includes('analysis-tier-definition is-active'));
  assert.ok(html.includes('How FOX2 defines these ranges'));
  assert.ok(html.includes('Balanced is above 60 through 120'));
  assert.ok(html.includes('14 completed calendar days before your latest measurement'));
  assert.ok(html.includes('Days without a saved score are left out'));
  assert.ok(html.indexOf('How FOX2 defines these ranges')<html.indexOf('FOX2 places you here'));
  assert.ok(html.indexOf('How FOX2 defines these ranges')<html.indexOf('analysis-tier-definitions'));
})();

(function usesNaturalRelativeDayNames(){
  assert.equal(context.analysisRelativeDay('2026-09-25','2026-09-30'),'Last Friday');
  assert.equal(context.analysisRelativeDay('2026-09-29','2026-09-30'),'Yesterday');
})();

(function removesRetiredAnalysisAndPatternUi(){
  const analysisSource=fs.readFileSync(__dirname+'/analysis.js','utf8');
  const pageSource=fs.readFileSync(__dirname+'/index.html','utf8');
  assert.ok(!analysisSource.includes('<h2 class="analysis-section-title">Fat Zone changes over time</h2>'));
  assert.ok(!pageSource.includes('>Fuel Pattern</button>'));
  assert.ok(!pageSource.includes('<div class="page pattern-page">'));
})();

(function keepsHistoryColorsAlignedWithFatZoneRanges(){
  const pageSource=fs.readFileSync(__dirname+'/index.html','utf8');
  assert.ok(pageSource.includes("var rounded = Math.round(ppm); return rounded <= 2 ? 0 : rounded <= 4 ? 1 : rounded <= 7 ? 2 : 3;"));
  assert.ok(pageSource.includes("var tabLabel = forcedView === 'zones' ? 'Fat Zones' : 'Summary';"));
  assert.ok(pageSource.includes("{ label: 'Low', value: Math.round(zt.glucose / total * 100) + '%', color: '#22D3EE'"));
  assert.ok(pageSource.includes("{ label: 'Balanced', value: Math.round(zt.mixed / total * 100) + '%', color: '#4ADE80'"));
  assert.ok(pageSource.includes("{ label: 'Higher +', value: Math.round(zt.fat / total * 100) + '%', color: '#A855F7'"));
})();

console.log('analysis tests passed');
