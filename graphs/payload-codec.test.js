const assert=require('assert');
const fs=require('fs');
const codec=require('./payload-codec.js');

function params(value){ return new URLSearchParams(value); }

{
  const result=codec.decode(params('d=s%3A'),21);
  assert.equal(result.supported,true);
  assert.equal(result.schemaLabel,'legacy_v1');
  assert.equal(result.scoreAlgorithm,null);
  assert.equal(result.days.length,21);
  assert.equal(result.days[0].measurementCount,null);
  assert.equal(result.days[0].measurementCountKnown,false);
  assert.equal(result.days[0].measured,null);
}

{
  const pairs=['00','01','02','0a','zz'];
  const result=codec.decode(params('x=214&n='+pairs.join('')),5);
  assert.equal(result.supported,true);
  assert.equal(result.schemaVersion,2);
  assert.equal(result.schemaLabel,'payload_v2');
  assert.equal(result.scoreAlgorithm,1);
  assert.equal(result.todayIndex,4);
  assert.equal(result.days[0].measurementCount,0);
  assert.equal(result.days[0].measured,false);
  assert.equal(result.days[1].measurementCount,1);
  assert.equal(result.days[1].dayState,'complete');
  assert.equal(result.days[3].measurementCount,10);
  assert.equal(result.days[3].dayState,'complete');
  assert.equal(result.days[4].measurementCount,null);
  assert.equal(result.days[4].measurementCountKnown,false);
  assert.equal(result.days[4].measured,true);
  assert.equal(result.days[4].dayState,'provisional');
}

{
  const result=codec.decode(params('x=212&n=01020300'),4);
  assert.equal(result.supported,true);
  assert.equal(result.days[2].dayState,'provisional');
  assert.equal(result.days[3].isFuture,true);
  assert.equal(result.days[3].dayState,null);
}

{
  const unknown=codec.decode(params('x=311&n=010101'),3);
  assert.equal(unknown.supported,false);
  assert.match(unknown.reason,/not supported/i);

  const malformedHeader=codec.decode(params('x=2!1&n=010101'),3);
  assert.equal(malformedHeader.supported,false);
  assert.match(malformedHeader.reason,/header/i);

  const malformedCounts=codec.decode(params('x=212&n=0102'),3);
  assert.equal(malformedCounts.supported,false);
  assert.match(malformedCounts.reason,/wrong length/i);

  const invalidToday=codec.decode(params('x=219&n=010101'),3);
  assert.equal(invalidToday.supported,false);
  assert.match(invalidToday.reason,/outside/i);
}

assert.deepEqual(codec.decodeCountPair('zz'),{
  valid:true,measured:true,count:null,countKnown:false
});
assert.deepEqual(codec.decodeCountPair('0a'),{
  valid:true,measured:true,count:10,countKnown:true
});

{
  const page=fs.readFileSync(require.resolve('./index.html'),'utf8');
  assert.ok(page.includes('<script src="payload-codec.js?v='),
    'the production results page should load the versioned payload codec');
  assert.ok(page.includes('Fox2PayloadCodec.decode(params,fox2PayloadDayCount)'),
    'the results page should decode metadata before parsing daily records');
  assert.ok(page.includes("if (!fox2PayloadMeta.supported) return;"),
    'unsupported explicit payload versions must never write live data');
  assert.ok(page.includes('if(!fox2PayloadMeta.supported) return;'),
    'unsupported explicit payload versions must not initialize the ordinary results UI');
  assert.ok(page.includes("(function setupSyncHandoff(){\n  if(typeof fox2PayloadMeta!=='undefined'&&!fox2PayloadMeta.supported) return;"),
    'unsupported explicit payload versions must not enter the NFC handoff flow');
  assert.ok(page.includes("document.documentElement.classList.add('payload-unsupported')"),
    'unsupported explicit payload versions should force a stable error screen');
  assert.ok(page.includes('html.payload-unsupported #loading { display: flex !important; }'),
    'later render work must not be able to hide the unsupported-version message');
  assert.ok(page.includes("payloadSchema:fox2PayloadMeta.schemaLabel"),
    'normalized day records should retain their payload schema');
  assert.ok(page.includes("scoreAlgorithm:fox2PayloadMeta.scoreAlgorithm"),
    'normalized day records should retain their score algorithm');
}

console.log('payload codec tests passed');
