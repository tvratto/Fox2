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

console.log('state-engine tests passed');
