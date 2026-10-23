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
assert.ok(source.includes('Maintain'));
assert.ok(source.includes('Add or change actions'));

console.log('program tests passed');
