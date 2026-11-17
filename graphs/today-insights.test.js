const assert=require('assert');
const insights=require('./today-insights.js');

function day(localDate,value,state='complete'){
  return {
    localDate,
    measured:true,
    displayDailyFatUse:value,
    canonicalAuc:value,
    dayState:state,
    representedMinutes:state==='complete'?1440:720
  };
}

assert.equal(insights.chooseInsight({date:'2026-11-16',today:'2026-11-16',records:[]}),null);
assert.equal(insights.chooseInsight({
  date:'2026-11-16',today:'2026-11-16',
  records:[{localDate:'2026-11-16',measured:true,displayDailyFatUse:null,canonicalAuc:null,dayState:'provisional'}]
}),null,'unknown Daily Fat Use must not become zero');

let result=insights.chooseInsight({
  date:'2026-11-16',today:'2026-11-16',
  records:[day('2026-11-15',100),day('2026-11-16',112,'provisional')]
});
assert.equal(result.kind,'already-higher');
assert.equal(result.text,'Your Daily Fat Use is higher today.');
assert.equal(result.detail,'Today is already 12% higher than your last measured day.');

result=insights.chooseInsight({
  date:'2026-11-16',today:'2026-11-16',
  records:[day('2026-11-12',80),day('2026-11-13',105),day('2026-11-14',95),day('2026-11-16',121,'provisional')]
});
assert.equal(result.kind,'recent-high');
assert.equal(result.text,'Your Daily Fat Use is at a recent high.');

result=insights.chooseInsight({
  date:'2026-11-16',today:'2026-11-16',
  records:[day('2026-11-15',120),day('2026-11-16',70,'provisional')]
});
assert.equal(result,null,'an unfinished lower day should not be compared with a completed day');

result=insights.chooseInsight({
  date:'2026-11-15',today:'2026-11-16',
  records:[day('2026-11-14',100),day('2026-11-15',82)]
});
assert.equal(result.kind,'day-change');
assert.equal(result.text,'Your Daily Fat Use was lower.');
assert.equal(result.detail,'It was 18% lower than your previous measured day.');

result=insights.chooseInsight({
  date:'2026-11-16',today:'2026-11-16',
  records:[
    day('2026-11-10',70),day('2026-11-11',72),day('2026-11-12',68),
    day('2026-11-13',84),day('2026-11-14',88),day('2026-11-15',86),
    day('2026-11-16',20,'provisional')
  ]
});
assert.equal(result.kind,'recent-trend');
assert.equal(result.text,'Your Daily Fat Use is increasing.');
assert.equal(result.detail,'Your last 3 measured days averaged 23% higher than the 3 before.');

result=insights.chooseInsight({
  date:'2026-11-16',today:'2026-11-16',
  records:[Object.assign(day('2026-11-16',12,'provisional'),{readings:[{minute:480,value:6}]})]
});
assert.equal(result.kind,'first-reading-zone');
assert.equal(result.text,'Your first reading today is High.');
assert.equal(result.detail,'Your first Fat Use Zone today was 6.');

result=insights.chooseInsight({
  date:'2026-11-16',today:'2026-11-16',
  records:[
    Object.assign(day('2026-11-15',95),{readings:[{minute:450,value:4}]}),
    Object.assign(day('2026-11-16',12,'provisional'),{readings:[{minute:480,value:6}]})
  ]
});
assert.equal(result.kind,'first-reading-change');
assert.equal(result.text,'Today started higher.');
assert.equal(result.detail,'Your first Fat Use Zone today was 6. Your previous measured day started at 4.');

console.log('Today insight tests passed');
