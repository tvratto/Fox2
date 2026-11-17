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
assert.ok(app.includes("record.displayDailyFatUse!==null?String(record.displayDailyFatUse):'—'"),'History should show Daily Fat Use under each day');
assert.ok(!html.includes('id="day-rail"')&&!css.includes('.day-pill.is-selected'),
  'Today should use swipe navigation without a separate date ribbon');
assert.ok(html.includes('timeline-score-button is-previous')&&html.includes('timeline-score-button is-current'),
  'Daily Fat Use should be integrated into both visible day bands');
assert.ok(css.includes('width:33.333%')&&css.includes('width:66.667%'),
  'yesterday should use one third of the timeline and the focused day two thirds');
assert.ok(html.includes('timeline-score-ring')&&!html.includes('<i>/</i>120'),
  'Daily Fat Use should use progress rings instead of an inline reference');
assert.ok(css.includes('width:82px')&&css.includes('width:58px'),
  'the focused-day ring should be larger than the past-day ring');
['daily-fat-use-info','metric-info-dialog'].forEach(id=>{
  assert.ok(html.includes(`id="${id}"`),`${id} should remain available for plain-language context`);
});
assert.ok(app.includes('This shows your fat use at that moment.'),
  'tapping a measurement should explain what the point represents');
assert.ok(app.includes('The ring fills toward 120, which is a reference number, not a grade.'),
  'the ring should explain 120 as a reference rather than a goal');
assert.ok(app.includes("openMetricInfo('score',score.dataset.scoreDate)"),
  'either visible Daily Fat Use score should remain tappable');
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
assert.ok(app.includes("downloadCsv('fox2-daily-fat-use.csv'"),'Daily Fat Use export should remain available');
assert.ok(app.includes("new BroadcastChannel('fox2-sync-'"),'NFC sync should update an established results page');
assert.ok(html.includes('id="utility-button"'),'share and export should use one quiet utility control');
assert.ok(!html.includes('>Community</button>'),'deferred Community must not create an empty tab');
assert.ok(!html.includes('today-insight')&&!app.includes('Fox2TodayInsights'),
  'Today should stay focused on the graph and the optional Tracking route');

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
assert.ok(css.includes('transparent 0 var(--score-progress),#303132 0')&&css.includes('var(--score-gradient'),
  'Daily Fat Use ring should reveal a day-specific graph gradient over gray');
assert.ok(app.includes('function scoreRingAppearance(date,progress)')&&app.includes("gradient:'conic-gradient(from 0deg,'")&&app.includes('color:zoneRgba(peak,1)'),
  'Daily Fat Use ring colors should stop at the highest tier actually present in that day’s curve');
assert.ok(html.includes('class="timeline-score-base"')&&html.includes('class="timeline-score-overflow"')&&css.includes('var(--score-overflow-color) 0 var(--score-overflow),#303132 0'),
  'scores above 120 should move the completed ring inward and fill a new outer loop');
assert.ok(app.includes("button.classList.toggle('has-overflow',overflow>0)")&&css.includes('.timeline-score-button.has-overflow{--base-inset:8px')&&css.includes('.timeline-score-button.is-previous.has-overflow{--base-inset:6px'),
  'the current and past-day rings should contract their completed loops independently');
assert.ok(app.includes('var scoreRingSpan=.985')&&css.includes('--ring-span:.985turn')&&css.includes('transform:rotate(var(--score-overflow))'),
  'both loops should use a visible 12-o’clock seam and a rounded moving endpoint');
assert.ok(app.includes('record.dailyFatUse/240*100'),
  'Tracking bars should use cumulative Daily Fat Use');
assert.ok(app.includes('before.map(function(record){return record.dailyFatUse;})'),
  'Tracking comparisons should use completed Daily Fat Use');
assert.ok(!html.includes('id="latest-reading"')&&!html.includes('>Latest</span>'),
  'the graph should not repeat the latest measurement in a permanent header block');
assert.ok(app.includes('function bindDayPointPopup(target,canvas,dots)')&&app.includes("value.textContent='Zone '"),
  'tapping a daily graph point should reveal its Zone and time');
assert.ok(css.includes('.app-shell{height:100svh')&&css.includes('.day-card-viewport{flex:1 1 auto;min-height:0}'),
  'the Today card should fit within the mobile viewport');
['#22D3EE','#4ADE80','#A855F7','#FF8C00'].forEach(color=>{
  assert.ok(app.includes(color),`graphs should preserve established color ${color}`);
});
assert.ok(app.includes('function drawTodayArea(ctx,samples,baseline,x,y,ceiling)')&&app.includes('function drawTodayLine(ctx,samples,x,y,baseline,ceiling)'),
  'Today should keep its own constrained area and dashed-line renderer');
assert.ok(app.includes('drawTodayArea(ctx,samples,base,x,y,ceiling)')&&app.includes('drawTodayLine(ctx,samples,x,y,base,ceiling)'),
  'Today should apply the shared History color scale to its visible graph');
assert.ok(app.includes('function todayCurveCeiling(rawMax)')&&app.includes('Math.round(rawMax)+3'),
  'Today should scale to the highest visible measurement plus three');
assert.ok(app.includes('ctx.arc(xx,yy,20')&&app.includes("font='800 22px"),
  'Today measurement values should sit inside large, readable markers');
assert.ok(app.includes('ctx.setLineDash([9,7])')&&app.includes('ctx.setLineDash([])'),
  'the inferred Today curve between measurements should be dashed');
assert.ok(app.includes('point.minute>=visibleStart&&point.minute<=visibleEnd'),
  'Today auto-scaling should use only the two days currently on screen');
assert.ok(app.includes('padT=80,ceiling=curve.ceiling')&&app.includes('ctx.moveTo(xx,padT);ctx.lineTo(xx,base)'),
  'Today should apply its max-plus-three scale across the full visible plot height');
assert.ok(app.includes('function modeledMidnightAnchor(date)')&&app.includes('1.03+.714*lastValue'),
  'Today should use the firmware midnight-anchor formula when the prior day was measured');
assert.ok(app.includes('synthetic:true')&&app.includes('curvePoints=actual.slice()'),
  'modeled midnight anchors should shape the curve without becoming measurement markers');
assert.ok(app.includes('function continuousZoneGradient(ctx,baseline,top,ceiling,alpha)'),
  'History should retain its established continuous tier gradient');
assert.ok(app.includes('zoneBlendWidth=.55'),
  'tier transitions should blend across a controlled Zone-width');
assert.ok(app.includes("var graphColorMode='level-bands'"),
  'horizontal level bands should remain the shipped graph-color default');
assert.ok(app.includes("graphColorMode==='time-columns'")&&app.includes('function continuousTimeGradient'),
  'the vertical time-column treatment should remain available through one renderer switch');
assert.ok(app.includes('color=tierColor(item.value)')&&app.includes('color=tierColor(point.value)'),
  'actual measurement dots should retain categorical tier colors');

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
