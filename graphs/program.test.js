const assert=require('assert');
const fs=require('fs');

const source=fs.readFileSync(__dirname+'/index.html','utf8');

const programTab=source.indexOf('data-page="0">Program</button>');
const dataTab=source.indexOf('data-page="1">Data</button>');
const historyTab=source.indexOf('data-page="2">History</button>');
const analysisTab=source.indexOf('data-page="3">Analysis</button>');

assert.ok(programTab>=0&&programTab<dataTab&&dataTab<historyTab&&historyTab<analysisTab,
  'navigation should be Program, Data, History, Analysis');
assert.ok(source.includes('id="program-shell"'),'program page should be mounted in the pager');
assert.ok(source.includes("fox2Program.optedOut=true"),'the intro should persist an explicit opt-out');
assert.ok(source.includes("window.fox2GoToPage(1,true)"),'opting out should route directly to Data');
assert.ok(source.includes("var activeProgram=!fox2Program.optedOut&&fox2Program.screen!=='maintain'"),
  'opted-out and maintenance users should open on Data on later visits');
assert.ok(source.includes('Use FOX2 without the program'),'intro should expose a clear non-program path');
assert.ok(source.includes('Finish measuring and view results'));
assert.ok(source.includes('Restart the measuring period'));
assert.ok(source.includes('Start over with a new baseline'));
assert.ok(source.includes('function fox2SetProgramHistory(readingRows,scoreRows)'),
  'the program should retain complete score history beyond the current NFC payload');
assert.ok(source.includes("fox2SetProgramHistory(historyReadings,historyScores)"),
  'server history should be supplied to the guided program');
assert.ok(source.includes('function fox2AllCompletedScoreDays()'),
  'guided program metrics should merge historical and current score days');
assert.ok(source.includes('function fox2PreviousBaselineDays()'),
  'historical baseline helper should exist');
assert.ok(source.includes("day.date<fox2Program.baselineStart"),
  'historical baseline must only use days before the program baseline began');
assert.ok(source.includes("readingCounts[date]!=null&&readingCounts[date]<2"),
  'historical days with raw readings should still require at least two readings');
assert.ok(source.includes("return fox2AllCompletedScoreDays().filter(function(day){return day.date>=start&&day.date<today;})"),
  'the measurement result should use all completed program days');
assert.ok(source.includes("canUsePrevious=previous.length>0"),
  'historical shortcut should become available with any completed historical day');
assert.ok(source.includes('Use previous 7 days · '),
  'baseline options should expose the historical shortcut and date range');
assert.ok(!source.includes('if(has||canUsePrevious){'),
  'baseline options should remain discoverable before the first program day');
assert.ok(source.includes("previous.length+' of 7 previous days available'"),
  'a partial historical shortcut should show how many days were found');
assert.ok(source.includes('disabled>0 of 7 previous days available'),
  'the historical shortcut should only be disabled when no historical days exist');
assert.ok(source.includes('function fox2OpenPreviousBaselineConfirm(previous)'),
  'using fewer than seven days should open a confirmation');
assert.ok(source.includes('FOX2 recommends 7 days for a more representative baseline.'),
  'the confirmation should explain why seven days are recommended');
assert.ok(source.includes("else if(previous.length){fox2OpenPreviousBaselineConfirm(previous);return;}"),
  'one to six historical days should be usable after confirmation');
assert.ok(source.includes('function fox2ConfirmPreviousBaseline()'),
  'the confirmation should apply the available historical days');
assert.ok(source.includes("data-program-action=\"use-previous-baseline\""));
assert.ok(source.includes('Maintain'));
assert.ok(source.includes('Add or change actions'));
assert.ok(source.includes('var FOX2_MEASURE_DAYS=30;'),
  'the measurement segment should last 30 days');
assert.ok(source.includes('var FOX2_PROGRAM_DAYS=FOX2_BASELINE_DAYS+FOX2_MEASURE_DAYS;'),
  'program progress should combine the seven-day baseline and 30-day measurement segment');
assert.ok(source.includes("' of '+FOX2_MEASURE_DAYS"),
  'the progress label should use the 30-day measurement duration');
assert.ok(source.includes("fox2DaysBetween(fox2Program.measureStart,fox2TodayIso())>=FOX2_MEASURE_DAYS"),
  'the program should advance to results after the 30-day measurement segment');
assert.ok(source.includes('Baseline ready'));
assert.ok(source.includes('Begin action'));
assert.ok(!source.includes("Yesterday's result"),
  'the first measuring day should not show an empty yesterday result');
assert.ok(source.includes('Your action so far'));
assert.ok(source.includes('completed \' + (metrics.measureDays.length===1?\'day\':\'days\') + \' included')||source.includes("completed '+(metrics.measureDays.length===1?'day':'days')+' included"),
  'the cumulative result should show how many completed days it includes');
assert.ok(source.includes('Continue your actions.'));
assert.ok(source.includes('function fox2SignedPercent(value)'));
assert.ok(source.includes('function fox2TodayScore()'),
  'the measure page should use today\'s accumulating daily score');
assert.ok(source.includes('todayScore:fox2TodayScore()'),
  'today\'s score should be part of guided-program metrics');
assert.ok(source.includes('function fox2TodayProgressHtml(metrics)'),
  'the measure page should render today\'s progress toward baseline');
assert.ok(source.includes("<h2>Today\\'s progress</h2>"));
assert.ok(source.includes("<small>of baseline</small>"));
assert.ok(source.includes("Your score builds as the day continues."));
assert.ok(source.includes("if(metrics.measureDays.length) content+='<button type=\"button\" class=\"program-option-card is-primary\""),
  'finish measuring should be hidden until it can be used, not shown disabled');
assert.ok(!source.includes("data-program-action=\"finish-measuring\" '+(metrics.measureDays.length?'':'disabled')"),
  'finish measuring should not appear as an unexplained disabled control');
assert.ok(source.includes("options.scrollIntoView({behavior:'smooth',block:'start',inline:'nearest'})"),
  'opening measure options should bring the controls into view');
assert.ok(source.includes("var returningFromSync=params.get('program')==='1'||params.has('sync_rev')||params.get('handoff')==='1'"),
  'the page should recognize a completed device sync');
assert.ok(source.includes("[0,100,500].forEach(function(delay)"),
  'the page should override delayed browser scroll restoration after a sync');
assert.ok(source.includes("window.setTimeout(function(){window.fox2GoToPage(0,false);},delay)"),
  'a sync during an active program should land on Program');
assert.ok(source.includes('(metrics.after-metrics.baseline)/metrics.baseline*100'),
  'the primary reward should be the cumulative action average versus baseline');
assert.ok(source.includes('function fox2AnimateMeasureResult()'));
assert.ok(source.includes("prefers-reduced-motion: reduce"),
  'the result animation should respect reduced-motion preferences');
assert.ok(source.includes("if(screen==='measure') window.setTimeout(fox2AnimateMeasureResult,0)"),
  'the cumulative result should animate after the measure page renders');

console.log('program tests passed');
