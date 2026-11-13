const assert=require('assert');
const fs=require('fs');
const codec=require('./time-codec.js');

function params(value){return new URLSearchParams(value);}

{
  const result=codec.decode(params('tz=420'),{schemaVersion:1});
  assert.equal(result.timeBasis,codec.LEGACY_BASIS);
  assert.equal(result.timeZone,null);
  assert.equal(result.utcOffsetMinutes,420);
  assert.equal(result.utcCapable,false);
}

{
  const result=codec.decode(params('tz=480&z=America%2FLos_Angeles'),{schemaVersion:2});
  assert.equal(result.timeBasis,codec.UTC_BASIS);
  assert.equal(result.timeZone,'America/Los_Angeles');
  assert.equal(result.utcOffsetMinutes,480);
  assert.equal(result.utcCapable,true);
}

assert.equal(codec.localToUtcIso('2026-11-10',8*60+15,'America/Los_Angeles'),'2026-11-10T16:15:00.000Z');
assert.equal(codec.localToUtcIso('2026-07-10',8*60+15,'America/Los_Angeles'),'2026-07-10T15:15:00.000Z');
assert.equal(codec.localToUtcIso('2026-03-08',2*60+30,'America/Los_Angeles'),null,
  'a nonexistent spring-forward wall time must not be invented');
assert.equal(codec.localToUtcIso('bad',60,'America/Los_Angeles'),null);

{
  const page=fs.readFileSync(require.resolve('./index.html'),'utf8');
  const app=fs.readFileSync(require.resolve('./app.js'),'utf8');
  assert.ok(page.includes('<script src="time-codec.js?v='));
  assert.ok(app.includes('Fox2TimeCodec.decode(params,payloadMeta)'));
  assert.ok(app.includes('reading_utc_ts:'));
  assert.ok(app.includes('local_date:'));
  assert.ok(app.includes('local_minute:'));
  assert.ok(app.includes('time_basis:'));
  assert.ok(app.includes('time_zone:'));
  assert.ok(app.includes('last_measurement_utc_at:'));
  assert.ok(app.includes("['z','time_zone']"));
}

console.log('time codec tests passed');
