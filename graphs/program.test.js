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
assert.ok(source.includes("fox2Program.optedOut||fox2Program.screen==='maintain'"),
  'opted-out and maintenance users should open on Data on later visits');
assert.ok(source.includes('Use FOX2 without the program'),'intro should expose a clear non-program path');
assert.ok(source.includes('Finish measuring now'));
assert.ok(source.includes('Restart measuring'));
assert.ok(source.includes('Start over with a new baseline'));
assert.ok(source.includes('function fox2PreviousBaselineDays()'),
  'historical baseline helper should exist');
assert.ok(source.includes("day.isoDate>=fox2Program.baselineStart"),
  'historical baseline must only use days before the program baseline began');
assert.ok(source.includes("!Array.isArray(day.pts)||day.pts.length>=2"),
  'settled historical scores should qualify when old raw readings are no longer in the payload');
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

console.log('program tests passed');
