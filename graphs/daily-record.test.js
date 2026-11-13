const assert=require('assert');
const fs=require('fs');
const path=require('path');
const daily=require('./daily-record.js');

{
  const record=daily.normalizeDay({
    localDate:'2026-11-11',measured:true,canonicalAuc:117.6,
    aucAuthoritative:true,dayState:'complete',scoreAlgorithm:2,
    payloadSchema:'payload_v2'
  });
  assert.equal(record.representedMinutes,1440);
  assert.ok(Math.abs(record.dailyAverage-4.9)<1e-12);
  assert.equal(record.displayDailyAverage,4.9);
  assert.equal(record.dailyFatUse,117.6);
  assert.equal(record.displayDailyFatUse,118);
  assert.equal(record.tierLabel,'Medium');
  assert.equal(record.tierLabel,'Medium');
  assert.equal(record.eligibleForTracking,true);
}

{
  const record=daily.normalizeDay({
    measured:true,canonicalAuc:31.5,aucAuthoritative:true,
    dayState:'provisional',representedMinutes:420
  });
  assert.equal(record.dailyAverage,4.5);
  assert.equal(record.displayDailyAverage,4.5);
  assert.equal(record.eligibleForTracking,false);
}

{
  const missingDuration=daily.normalizeDay({
    measured:true,canonicalAuc:31.5,aucAuthoritative:true,
    dayState:'provisional',representedMinutes:null
  });
  assert.equal(missingDuration.dailyAverage,null,
    'a provisional average must not be invented without matching duration');
}

{
  const compressedOnly=daily.normalizeDay({
    measured:true,canonicalAuc:31.5,aucAuthoritative:false,
    dayState:'complete',representedMinutes:1440
  });
  assert.equal(compressedOnly.canonicalAuc,null);
  assert.equal(compressedOnly.dailyFatUse,null);
  assert.equal(compressedOnly.dailyAverage,null,
    'compressed graph points must not become a canonical Daily Average');
}

{
  const measuredZero=daily.normalizeDay({
    measured:true,canonicalAuc:0,aucAuthoritative:true,
    dayState:'complete'
  });
  assert.equal(measuredZero.dailyAverage,0);
  assert.equal(measuredZero.displayDailyFatUse,0);
  assert.equal(measuredZero.tierLabel,'Low');
  assert.equal(measuredZero.eligibleForTracking,true);
}

{
  const unmeasured=daily.normalizeDay({
    measured:false,canonicalAuc:0,aucAuthoritative:true,dayState:'complete'
  });
  assert.equal(unmeasured.dayState,null);
  assert.equal(unmeasured.dailyAverage,null);
  assert.equal(unmeasured.displayDailyFatUse,null);
}

{
  assert.equal(daily.tierForAverage(2.9).label,'Low');
  assert.equal(daily.tierForAverage(3).label,'Medium');
  assert.equal(daily.tierForAverage(5).label,'High');
  assert.equal(daily.tierForAverage(8).label,'Very High');
}

{
  const existing={representedMinutes:1440,scoreAlgorithm:2};
  const legacyNewer={representedMinutes:null,scoreAlgorithm:null};
  const merged=daily.mergeRecord(existing,legacyNewer,{incomingIsNewer:true});
  assert.equal(merged.representedMinutes,1440);
  assert.equal(merged.scoreAlgorithm,2);
}

{
  const fields=daily.persistenceFields({
    representedMinutes:1440,dailyAverage:4.9,dayState:'complete',
    scoreAlgorithm:2
  });
  assert.deepEqual(fields,{
    represented_duration_minutes:1440,score_algorithm:2
  });
}

{
  const page=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
  const app=fs.readFileSync(path.join(__dirname,'app.js'),'utf8');
  assert.ok(page.includes('<script src="daily-record.js?v='));
  assert.ok(app.includes('Fox2DailyRecord.normalizeDay'));
  assert.ok(app.includes('Fox2DailyRecord.persistenceFields'));
  assert.ok(app.includes("last_m_param:params.get('m')"));
}

{
  const migration=fs.readFileSync(path.join(__dirname,'..','supabase','migrations','202611120001_canonical_daily_records.sql'),'utf8');
  ['represented_duration_minutes','score_algorithm',
   'last_x_param','last_m_param','last_r_param'].forEach(column=>{
    assert.ok(migration.includes(column),`migration should add ${column}`);
  });
}

console.log('daily record tests passed');
