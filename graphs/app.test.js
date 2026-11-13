const assert=require('assert');
const fs=require('fs');
const path=require('path');

const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const app=fs.readFileSync(path.join(__dirname,'app.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'app.css'),'utf8');

assert.ok(html.includes('>Today</button>'));
assert.ok(html.includes('>Tracking</button>'));
assert.ok(html.includes('>History</button>'));
['>Progress</button>','>Data</button>','>Analysis</button>','Squad','Fat Use Score'].forEach(oldCopy=>{
  assert.ok(!html.includes(oldCopy),`production shell should not contain ${oldCopy}`);
});

assert.ok(app.includes("slice(-3).map"),'Before should use at most three prior completed days');
assert.ok(app.includes('for(var i=0;i<30;i++)'),'Tracking should always render all 30 positions');
assert.ok(app.includes("date===localToday&&record&&record.dayState==='provisional'"),
  'Today should be visibly provisional');
assert.ok(app.includes('filter(function(record){return record&&record.eligibleForTracking;})'),
  'partial days must not enter Tracking calculations');
assert.ok(app.includes("status='stopped'"),'stopped periods should be saved to History');
assert.ok(app.includes("status='completed'"),'Day 30 should complete into History');
assert.ok(app.includes("p_expected_revision:trackingRevision"),
  'Tracking saves should remain protected from stale tabs');
assert.ok(!app.includes('window.prompt('),'management controls should use the product sheet, not a browser prompt');
assert.ok(app.includes("'/rest/v1/rpc/get_share_snapshot'"),'frozen share links should remain readable');
assert.ok(app.includes("'/rest/v1/rpc/create_share_snapshot'"),'new frozen share links should remain available');
assert.ok(app.includes("downloadCsv('fox2-measurements.csv'"),'measurement export should remain available');
assert.ok(app.includes("downloadCsv('fox2-daily-averages.csv'"),'daily-average export should remain available');
assert.ok(app.includes("new BroadcastChannel('fox2-sync-'"),'NFC sync should update an established results page');
assert.ok(html.includes('id="utility-button"'),'share and export should use one quiet utility control');
assert.ok(!html.includes('>Community</button>'),'deferred Community must not create an empty tab');

assert.ok(css.includes('.average-line.before'));
assert.ok(css.includes('border-top-style:dashed'));
assert.ok(css.includes('.tracking-bar.is-today'));

['analysis.js','copy-generator.js','state-engine.js'].forEach(filename=>{
  assert.equal(fs.existsSync(path.join(__dirname,filename)),false,
    `${filename} should not remain in the replacement runtime`);
});

const migration=fs.readFileSync(path.join(__dirname,'..','supabase','migrations','202611120001_canonical_daily_records.sql'),'utf8');
['daily_average','day_state','measurement_count','measurement_count_known','payload_schema_version'].forEach(redundant=>{
  assert.ok(!migration.includes(`add column if not exists ${redundant}`),
    `${redundant} should be derived instead of stored`);
});

const stateMigration=fs.readFileSync(path.join(__dirname,'..','supabase','migrations','202611120002_tracking_state_v2.sql'),'utf8');
assert.ok(stateMigration.includes("p_state->>'v' not in ('1', '2')"));
assert.ok(stateMigration.includes("jsonb_typeof(p_state->'tracking') <> 'object'"));

console.log('simplified app tests passed');
