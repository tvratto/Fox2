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
  const dates=['2026-01-05','2026-01-06','2026-01-07','2026-01-08','2026-01-09','2026-01-10'];
  const history={
    days:dates.map((date,index)=>({date,score:70+index*3})),
    points:dates.slice(0,3).flatMap(date=>[
      {date,minute:400,value:2},
      {date,minute:520,value:4.5}
    ])
  };
  const tags=dates.slice(0,3).map(date=>({
    day_date:date,
    events:[{icon:'🚶',name:'Walk',minute:420}],
    tray_tags:['🚶']
  }));
  const insight=context.buildTagInsight(tags,history);
  assert.equal(insight.question,'What appears to be helping?');
  assert.ok(insight.answer.includes('3 of 3'));
  assert.ok(insight.answer.includes('Try it again'));
})();

(function promptsForAnExperimentWithoutTags(){
  const insight=context.buildTagInsight([], {days:[],points:[]});
  assert.equal(insight.question,'What should I try next?');
  assert.ok(insight.answer.includes('tag it'));
})();

(function avoidsInternalLanguageInFirstDayCopy(){
  const sample=[
    {date:'2026-01-05',score:90,movement:'responsive',range:4,responseAmplitude:3},
    {date:'2026-01-12',score:60,movement:'responsive',range:3,responseAmplitude:3}
  ];
  const wtd=engine.buildWeekToDate(sample,{referenceDate:'2026-01-13'});
  const copy=context.weekToDateCopy(wtd,null);
  assert.equal(copy.question,'Am I still making progress?');
  assert.ok(copy.summary.includes('Yesterday'));
  assert.ok(!/quiet|responsive|pattern/i.test(copy.title+' '+copy.summary+' '+copy.answer));
})();

console.log('analysis tests passed');
