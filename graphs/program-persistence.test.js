const assert=require('assert');
const fs=require('fs');
const path=require('path');

const source=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const migration=fs.readFileSync(path.join(__dirname,'..','supabase','migrations','202611020001_device_program_states.sql'),'utf8');

(function activeProgramUsesDeviceLinkedRemoteStorage(){
  assert.ok(source.includes("fox2RemoteProgramRequest('get_device_program_state'"),
    'Progress should load the active device program from Supabase');
  assert.ok(source.includes("fox2RemoteProgramRequest('save_device_program_state'"),
    'Progress should save active program edits to Supabase');
  assert.ok(source.includes('p_expected_revision:fox2ProgramRemoteRevision'),
    'remote saves should use optimistic revision protection');
  assert.ok(source.includes('fox2LoadRemoteProgramState();'),
    'remote state should load during normal Progress initialization');
  assert.ok(source.includes('fox2MarkRemoteProgramDirty();')&&source.includes('fox2QueueRemoteProgramSave();'),
    'browser storage should remain an immediate cache while remote persistence is queued');
  assert.ok(source.includes('fox2ScheduleRemoteProgramRetry();')&&source.includes('fox2ProgramRemoteRetryDelay*4'),
    'temporary Supabase failures should retry quietly with bounded backoff');
  assert.ok(source.includes("fox2SaveProgramBackup('updated on another device')"),
    'a stale local draft should be preserved instead of overwriting newer remote state');
})();

(function remoteSnapshotIncludesTheWholeProgram(){
  const expected={
    baselineMode:'baselineMode:fox2Program.baselineMode',
    baselineStart:'baselineStart:fox2IsoOrBlank(fox2Program.baselineStart)',
    baselineValue:'baselineValue:Number(fox2Program.baselineValue)',
    baselineSource:'baselineSource:String(fox2Program.baselineSource',
    baselineRange:'baselineRange:String(fox2Program.baselineRange',
    action:'action:String(fox2Program.action',
    measureStart:'measureStart:fox2IsoOrBlank(fox2Program.measureStart)',
    targetDays:'targetDays:fox2ProgramTargetDays()',
    resultHistory:'resultHistory:(Array.isArray(fox2Program.resultHistory)',
    firstMeasurementSynced:'firstMeasurementSynced:!!fox2Program.firstMeasurementSynced'
  };
  Object.keys(expected).forEach(field=>assert.ok(source.includes(expected[field]),
    `remote Progress state should include ${field}`));
})();

(function databaseSurfaceIsBoundedAndNonEnumerable(){
  assert.ok(migration.includes('create table if not exists public.device_program_states'));
  assert.ok(migration.includes('revoke all on table public.device_program_states from public, anon, authenticated'));
  assert.ok(migration.includes('octet_length(p_state::text) > 32768'));
  assert.ok(migration.includes('pg_advisory_xact_lock'));
  assert.ok(migration.includes("'conflict', true"));
  assert.ok(migration.includes('grant execute on function public.get_device_program_state(text) to anon, authenticated'));
  assert.ok(migration.includes('grant execute on function public.save_device_program_state(text, jsonb, bigint) to anon, authenticated'));
})();

console.log('program persistence tests passed');
