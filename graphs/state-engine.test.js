const assert=require('assert');
const engine=require('./state-engine.js');

function days(start,scores,responsive){
  const startDate=new Date(start+'T00:00:00Z');
  return scores.map(function(score,index){
    const date=new Date(startDate);
    date.setUTCDate(date.getUTCDate()+index);
    return {
      date:date.toISOString().slice(0,10),
      score:score,
      movement:responsive.indexOf(index)!==-1?'responsive':'steady',
      responseAmplitude:responsive.indexOf(index)!==-1?3:0
    };
  });
}

(function classifiesLowQuiet(){
  const states=engine.buildWeeklyStates(days('2026-01-01',[35,40,42,45,49,51,55],[]),{endDate:'2026-01-07'});
  assert.equal(engine.currentState(states).stateId,'LOW_QUIET');
})();

(function classifiesModerateActive(){
  const states=engine.buildWeeklyStates(days('2026-01-01',[72,88,95,102,108,112,118],[0,1,2,3,4]),{endDate:'2026-01-07'});
  const current=engine.currentState(states);
  assert.equal(current.stateId,'MODERATE_ACTIVE');
  assert.deepEqual(current.metrics.bandDays,{low:0,moderate:7,higher:0,strong:0});
  assert.equal(current.metrics.above60Days,7);
  assert.equal(current.metrics.above120Days,0);
  assert.equal(current.metrics.longestStreakAbove60,7);
})();

(function tracksAllScoreBands(){
  const states=engine.buildWeeklyStates(days('2026-01-01',[40,60,61,120,121,180,181],[]),{endDate:'2026-01-07'});
  const metrics=engine.currentState(states).metrics;
  assert.deepEqual(metrics.bandDays,{low:2,moderate:2,higher:2,strong:1});
  assert.equal(metrics.above60Days,5);
  assert.equal(metrics.above120Days,3);
  assert.equal(metrics.above180Days,1);
})();

(function tracksThresholdDirectionChanges(){
  const sample=days('2026-01-01',[40,45,50,55,60,58,52,70,80,90,130,145,190,200],[]);
  const states=engine.buildWeeklyStates(sample,{endDate:'2026-01-14'});
  const transition=engine.currentState(states).transition;
  assert.equal(transition.above60Direction,'rising');
  assert.equal(transition.above120Direction,'rising');
  assert.equal(transition.above180Direction,'rising');
  assert.ok(transition.changes.includes('above_60_rising'));
})();

(function detectsPersistentHighSteady(){
  const sample=days('2026-01-01',[145,150,155,160,165,170,175,148,152,158,162,168,172,178],[]);
  const states=engine.buildWeeklyStates(sample,{endDate:'2026-01-14'});
  assert.equal(states[0].safetyFlag,'watch_high_steady');
  assert.equal(states[1].safetyFlag,'persistent_high_steady');
})();

(function preservesTrendAcrossDataGapWithoutPreservingStreak(){
  const sample=days('2026-01-01',[70,75,80,85,90,0,0,0,0,0,0,0,0,0,100,105,110,115,120],[])
    .filter(function(day){return day.score>0;});
  const states=engine.buildWeeklyStates(sample,{endDate:'2026-01-21'});
  const current=engine.currentState(states);
  assert.ok(current.transition.gapWindows>0);
  assert.equal(current.transition.scoreDirection,'rising');
  assert.equal(current.stateStreak,1);
})();

(function usesCompletedMondayToSundayWeeks(){
  const sample=days('2026-01-05',[70,72,74,76,78,80,82,140,142],[]);
  const states=engine.buildCalendarWeekStates(sample,{referenceDate:'2026-01-14'});
  const current=engine.currentState(states);
  assert.equal(current.startDate,'2026-01-05');
  assert.equal(current.endDate,'2026-01-11');
  assert.equal(current.classifiableDays,7);
})();

(function comparesWeekToDateWithSameElapsedWeekdays(){
  const sample=days('2026-01-05',[40,45,50,55,60,65,70,80,95],[]);
  const wtd=engine.buildWeekToDate(sample,{referenceDate:'2026-01-14'});
  assert.equal(wtd.startDate,'2026-01-12');
  assert.equal(wtd.throughDate,'2026-01-13');
  assert.equal(wtd.previous.startDate,'2026-01-05');
  assert.equal(wtd.previous.endDate,'2026-01-06');
  assert.equal(wtd.current.classifiableDays,2);
  assert.equal(wtd.previous.classifiableDays,2);
  assert.equal(wtd.trajectory,'building');
})();

(function detectsWithinWeekRecovery(){
  const sample=days('2026-01-12',[40,42,72,85],[3]);
  const wtd=engine.buildWeekToDate(sample,{referenceDate:'2026-01-16'});
  assert.equal(wtd.trajectory,'recovering');
})();

(function flagsHighQuietWeekToDate(){
  const sample=days('2026-01-12',[190,195,200],[]);
  const wtd=engine.buildWeekToDate(sample,{referenceDate:'2026-01-15'});
  assert.equal(wtd.trajectory,'possibly_overextended');
})();

(function comparesAFirstDayWithThePriorWeek(){
  const sample=[
    {date:'2026-01-05',score:45,movement:'steady',responseAmplitude:0},
    {date:'2026-01-12',score:75,movement:'responsive',responseAmplitude:3}
  ];
  const wtd=engine.buildWeekToDate(sample,{referenceDate:'2026-01-13'});
  assert.equal(wtd.current.classifiableDays,1);
  assert.equal(wtd.previous.classifiableDays,1);
  assert.equal(wtd.trajectory,'building');
  assert.equal(wtd.comparison.scoreDelta,30);
})();

(function describesAFirstDayWithoutHistory(){
  const sample=[{date:'2026-01-12',score:75,movement:'steady',responseAmplitude:0}];
  const wtd=engine.buildWeekToDate(sample,{referenceDate:'2026-01-13'});
  assert.equal(wtd.trajectory,'early');
})();

console.log('state-engine tests passed');
