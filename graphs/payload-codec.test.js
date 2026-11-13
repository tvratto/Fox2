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
  assert.equal(result.days[0].measured,null);
}

{
  const result=codec.decode(params('x=214&r=0m0&m=0000u'),5);
  assert.equal(result.supported,true);
  assert.equal(result.schemaVersion,2);
  assert.equal(result.schemaLabel,'payload_v2');
  assert.equal(result.scoreAlgorithm,1);
  assert.equal(result.todayIndex,4);
  assert.equal(result.days[0].measured,false);
  assert.equal(result.days[1].dayState,'complete');
  assert.equal(result.days[3].dayState,'complete');
  assert.equal(result.days[4].measured,true);
  assert.equal(result.days[4].dayState,'provisional');
  assert.equal(result.days[4].representedMinutes,792);
}

{
  const result=codec.decode(params('x=212&r=0c0&m=00007'),4);
  assert.equal(result.supported,true);
  assert.equal(result.days[2].dayState,'provisional');
  assert.equal(result.days[0].representedMinutes,1440);
  assert.equal(result.days[2].representedMinutes,432);
  assert.equal(result.days[3].isFuture,true);
  assert.equal(result.days[3].dayState,null);
}

{
  const unknown=codec.decode(params('x=311&r=001&m=00007'),3);
  assert.equal(unknown.supported,false);
  assert.match(unknown.reason,/not supported/i);

  const malformedHeader=codec.decode(params('x=2!1&r=001&m=00007'),3);
  assert.equal(malformedHeader.supported,false);
  assert.match(malformedHeader.reason,/header/i);

  const malformedMask=codec.decode(params('x=212&r=001&m=not!5'),3);
  assert.equal(malformedMask.supported,false);
  assert.match(malformedMask.reason,/mask/i);

  const invalidToday=codec.decode(params('x=219&r=001&m=00007'),3);
  assert.equal(invalidToday.supported,false);
  assert.match(invalidToday.reason,/outside/i);

  const missingDuration=codec.decode(params('x=212&m=00007'),3);
  assert.equal(missingDuration.supported,false);
  assert.match(missingDuration.reason,/duration/i);

  const outOfRangeDuration=codec.decode(params('x=212&r=zzz&m=00007'),3);
  assert.equal(outOfRangeDuration.supported,false);
}

assert.deepEqual(codec.decodeMeasuredMask('0000u',5),{valid:true,mask:30});
assert.deepEqual(codec.decodeMeasuredMask('0000z',5),{valid:false,mask:0});
assert.deepEqual(codec.decodeRepresentedMinutes('140'),{valid:true,minutes:1440});
assert.deepEqual(codec.decodeRepresentedMinutes('000'),{valid:true,minutes:null});
assert.deepEqual(codec.decodeRepresentedMinutes('zzz'),{valid:false,minutes:null});
assert.equal(codec.inferLegacyRepresentedMinutes([{minute:360},{minute:480}]),480);
assert.equal(codec.inferLegacyRepresentedMinutes([{minute:0}]),null);
assert.equal(codec.inferLegacyRepresentedMinutes([{minute:1295}]),null,
  'the legacy two-character timestamp ceiling is ambiguous');

{
  const page=fs.readFileSync(require.resolve('./index.html'),'utf8');
  const app=fs.readFileSync(require.resolve('./app.js'),'utf8');
  assert.ok(page.includes('<script src="payload-codec.js?v='),
    'the production results page should load the versioned payload codec');
  assert.ok(app.includes('Fox2PayloadCodec.decode(params,dayCount)'),
    'the results page should decode metadata before parsing daily records');
  assert.ok(app.includes("!dParam||!payloadMeta||!payloadMeta.supported) return true"),
    'unsupported explicit payload versions must never write live data');
  assert.ok(app.includes("document.getElementById('unsupported-state').hidden=false"),
    'unsupported explicit payload versions should render a stable error state');
  assert.ok(app.includes("payloadSchema:payloadMeta.schemaLabel"),
    'normalized day records should retain their payload schema');
  assert.ok(app.includes("scoreAlgorithm:payloadMeta.scoreAlgorithm"),
    'normalized day records should retain their score algorithm');
  assert.ok(app.includes('Fox2PayloadCodec.inferLegacyRepresentedMinutes(readings)'),
    'legacy Today should recover represented duration from its exact latest point');
}

console.log('payload codec tests passed');
