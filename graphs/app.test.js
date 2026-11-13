const assert=require('assert');
const fs=require('fs');
const path=require('path');

const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const app=fs.readFileSync(path.join(__dirname,'app.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'app.css'),'utf8');

assert.ok(html.includes('>Today</button>'));
assert.ok(html.includes('>Tracking</button>'));
assert.ok(html.includes('>History</button>'));
assert.ok(html.includes('>Log</button>'));
['>Progress</button>','>Data</button>','>Analysis</button>','Squad','Fat Use Score'].forEach(oldCopy=>{
  assert.ok(!html.includes(oldCopy),`production shell should not contain ${oldCopy}`);
});

assert.ok(app.includes("slice(-3).map"),'Before should use at most three prior completed days');
assert.ok(app.includes('for(var i=0;i<30;i++)'),'Tracking should always render all 30 positions');
assert.ok(app.includes("date===localToday&&record&&record.dayState==='provisional'"),
  'Today should be visibly provisional');
assert.ok(app.includes('filter(function(record){return record&&record.eligibleForTracking;})'),
  'partial days must not enter Tracking calculations');
assert.ok(app.includes("status='stopped'"),'stopped periods should be saved to Log');
assert.ok(app.includes("status='completed'"),'Day 30 should complete into Log');
assert.ok(app.includes("select=local_date,local_minute,ppm"),'History should load the complete measurement series');
assert.ok(app.includes('function renderHistory()'),'History should render the measurement graph');
assert.ok(app.includes("record.displayDailyAverage.toFixed(1)"),'History should show Daily Average under each day');
assert.ok(html.includes('id="day-rail"'),'Today should preserve the established date rail');
assert.ok(css.includes('.day-pill.is-selected'),'Today should preserve the selected-day treatment');
assert.ok(app.includes("ctx.fillText('3 WEEKS'")&&app.includes('pillW=220'),
  'History should preserve the established centered three-week range pill');
assert.ok(app.includes('historyPage'),'all History weeks should remain reachable through paging');
assert.ok(app.includes("document.getElementById('log-content')"),'Log should render Tracking results separately');
assert.ok(app.includes("p_expected_revision:trackingRevision"),
  'Tracking saves should remain protected from stale tabs');
assert.ok(!app.includes('window.prompt('),'management controls should use the product sheet, not a browser prompt');
assert.ok(!app.includes('Saved on this phone'),'the interface should not expose an unclear local-fallback message');
assert.ok(!app.includes('Saved just now')&&!html.includes('id="sync-status"'),
  'successful background persistence should not add status copy to Today');
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
assert.ok(css.includes('.history-canvas'));
assert.ok(app.includes('function catmullSamples(knots)'),'Today and History should preserve fitted curves');
assert.ok(app.includes('reflectedFirst')&&app.includes('reflectedLast'),
  'History should preserve the original reflected spline endpoints');
assert.ok(app.includes('function constrainedDerivatives(xs,ys)')&&app.includes('function sampleConstrainedKnots(knots,from,to)'),
  'Today should use the established constrained spline fit');
assert.ok(!html.includes('id="panel-track"')&&!css.includes('.panel-track'),
  'primary tabs should not be horizontally swipeable pages');
assert.ok(app.includes('function bindDayPager()')&&css.includes('.day-card-track.is-dragging'),
  'Today should preserve the finger-following day-card pager');
assert.ok(app.indexOf('panel.appendChild(card)')<app.indexOf('renderDayChart(recordForDate(pair[1])'),
  'neighbor graphs should render only after their phone-width panels are mounted');
assert.ok(app.includes("date===localToday?'Take a measurement, then tap your phone to see it here.':'No measurements'"),
  'past empty days should use a neutral no-measurements message');
assert.ok(app.includes('average.classList.add(tierClass(record))'),
  'the Daily Average number should use its own tier color');
assert.ok(css.includes('.app-shell{height:100svh')&&css.includes('.day-card-viewport{flex:1 1 auto;min-height:0}'),
  'the Today card should fit within the mobile viewport');
['#22D3EE','#4ADE80','#A855F7','#FF8C00'].forEach(color=>{
  assert.ok(app.includes(color),`graphs should preserve established color ${color}`);
});

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
