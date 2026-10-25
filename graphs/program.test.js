const assert=require('assert');
const fs=require('fs');

const source=fs.readFileSync(__dirname+'/index.html','utf8');

const programTab=source.indexOf('data-page="0">Progress</button>');
const dataTab=source.indexOf('data-page="1">Data</button>');
const historyTab=source.indexOf('data-page="2">History</button>');
const analysisTab=source.indexOf('data-page="3">Analysis</button>');

assert.ok(programTab>=0&&programTab<dataTab&&dataTab<historyTab&&historyTab<analysisTab,
  'navigation should be Progress, Data, History, Analysis');
assert.ok(source.includes('id="program-shell"'),'program page should be mounted in the pager');
assert.ok(source.includes("fox2Program.optedOut=true"),'the intro should persist an explicit opt-out');
assert.ok(source.includes("window.fox2GoToPage(1,true)"),'opting out should route directly to Data');
assert.ok(source.includes("var activeProgram=fox2ProgramReadOnly||(!fox2Program.optedOut&&fox2Program.screen!=='maintain')"),
  'opted-out and maintenance users should open on Data on later visits');
assert.ok(source.includes('FOX2 Progress Tracking'),'the primary experience should have a clear name');
assert.ok(source.includes('View data only'),'intro should expose a clear path outside Progress Tracking');
assert.ok(source.includes('Start Tracking'));
assert.ok(source.includes('Finish tracking and view result'));
assert.ok(source.includes('Restart the tracking period'));
assert.ok(source.includes('Start over with a new starting point'));
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
assert.ok(source.includes('FOX2 recommends 7 days for a more representative starting point.'),
  'the confirmation should explain why seven days are recommended');
assert.ok(source.includes("else if(previous.length){fox2OpenPreviousBaselineConfirm(previous);return;}"),
  'one to six historical days should be usable after confirmation');
assert.ok(source.includes('function fox2ConfirmPreviousBaseline()'),
  'the confirmation should apply the available historical days');
assert.ok(source.includes("data-program-action=\"use-previous-baseline\""));
assert.ok(source.includes('Keep tracking'));
assert.ok(source.includes('Add or change actions'));
assert.ok(source.includes('var FOX2_MEASURE_DAYS=30;'),
  'the measurement segment should last 30 days');
assert.ok(source.includes('var FOX2_PROGRAM_DAYS=FOX2_BASELINE_DAYS+FOX2_MEASURE_DAYS;'),
  'program progress should combine the seven-day baseline and 30-day measurement segment');
assert.ok(!source.includes("phase='Measure · Day '"),
  'the progress block should not repeat the current measuring day');
assert.ok(source.includes("fox2DaysBetween(fox2Program.measureStart,fox2TodayIso())>=FOX2_MEASURE_DAYS"),
  'the program should advance to results after the 30-day measurement segment');
assert.ok(source.includes('Starting point ready'));
assert.ok(source.includes('Start tracking'));
assert.ok(!source.includes("Yesterday's result"),
  'the first measuring day should not show an empty yesterday result');
assert.ok(source.includes("action=fox2Program.action||'Your action'"));
assert.ok(!source.includes("completed '+(metrics.measureDays.length===1?'day':'days')+' included"),
  'the compact measure page should not repeat the completed-day count');
assert.ok(!source.includes('Continue your actions.'),
  'the compact measure page should not repeat generic next-step messaging');
assert.ok(source.includes('function fox2SignedPercent(value)'));
assert.ok(source.includes('function fox2MeasureDashboardHtml(metrics)'),
  'the measure page should present the completed-day recap and cumulative action progress');
assert.ok(!source.includes('Today So Far'),
  'the progress page should not mix an unfinished current day into the completed-day story');
assert.ok(source.includes('Morning Recap'));
assert.ok(source.includes('30-Day Fat Use Scores'));
assert.ok(source.includes('Results So Far'));
assert.ok(source.includes('function fox2RingVisual(score)'),
  'the recap ring should retain the firmware ring tiers');
assert.ok(source.includes("bands=[60,120,180,240]"),
  'the web recap should use the same graduating score scales as the device');
assert.ok(source.includes('function fox2RecapMorphPath(fillFraction,amount,targetX,targetTop,targetBottom)'),
  'the completed ring should have a real path-straightening animation');
assert.ok(source.includes('totalTurn=sweep*(1-p)'),
  'the morph should remove curvature continuously rather than cross-fading shapes');
assert.ok(source.includes('program-recap-baseline'),
  'the 30-day view should retain the starting point as a quiet comparison');
assert.ok(source.includes('fox2RecapHistorySvg(model)'),
  'the ring should land in the same 30-day chart shown after the recap');
assert.ok(source.includes('for(var i=0;i<FOX2_MEASURE_DAYS;i++)'),
  'the chart should always build all 30 tracking-day positions');
assert.ok(source.includes("day.x=18+index*(300/(FOX2_MEASURE_DAYS-1))"),
  'all 30 chart positions should fit into one fixed view');
assert.ok(source.includes('class="program-recap-slot"'),
  'unfinished tracking days should remain visibly open');
assert.ok(source.includes('.program-recap-bar-base { stroke:#ff8c00;'),
  'every completed day should use the same orange base');
assert.ok(source.includes('.program-recap-bar-above { stroke:#ffb84d;'),
  'only the portion above the starting point should use lighter orange');
assert.ok(source.includes("index===model.completed-1"),
  'the newest completed day should land immediately after the earlier completed bars');
assert.ok(source.includes("root.classList.add('is-morphing')"));
assert.ok(source.includes("root.classList.add('is-history-visible')"));
assert.ok(source.includes("'is-bar-landed'"));
assert.ok(source.includes("root.classList.add('is-settled')"));
assert.ok(source.includes('function fox2ShouldAnimateRecap(model)'),
  'the completed-day animation should be guarded per synced result');
assert.ok(source.includes("localStorage.getItem(fox2RecapSeenKey())!==model.latest.date"),
  'a completed day should not replay on every ordinary reload');
assert.ok(source.includes('if(fox2ProgramDemoSnapshot) return true'),
  'the interactive prototype should remain easy to replay on a fresh load');
assert.ok(source.includes('fox2MarkRecapSeen(latestDate)'),
  'the newly presented result should be recorded only after its story completes');
assert.ok(source.includes('data-recap-replay'),
  'the completed 30-day chart should expose a small recap replay control');
assert.ok(source.includes('function fox2ReplayMeasureRecap()'),
  'the replay control should restart the recap without changing program data');
assert.ok(source.includes("root.classList.remove('is-morphing','is-history-visible','is-bar-landed','is-settled')"),
  'replay should reset the visual sequence before starting again');
assert.ok(source.includes("fox2AnimateValue(.002,fill,432"),
  'the web recap should match the firmware ring-fill timing');
assert.ok(source.includes("fox2AnimateValue(0,1,416"),
  'the ring should straighten over the same sixteen-frame interval as firmware');
assert.ok(source.includes("},1400);"),
  'the completed ring should hold long enough to read before straightening');
assert.ok(source.includes('function fox2RevealRecapHistory(root,done)'),
  'older history bars should reveal only after the newest result lands');
assert.ok(source.includes("path.setAttribute('stroke-width','6.5')"),
  'the morph should land at the exact width of the settled chart bar');
assert.ok(source.includes('program-measure-dashboard'));
assert.ok(source.includes('<div class="program-recap-action">\'+fox2Escape(action)+\'</div>'));
assert.ok(source.includes('Fat Use Score versus starting point'));
assert.ok(!source.includes('<div class="program-action-name"><span>Your actions</span>'));
assert.ok(!source.includes("Your score builds as the day continues."));
assert.ok(!source.includes('Measure as usual. Sync again tomorrow.'));
assert.ok(source.includes("if(metrics.measureDays.length) content+='<button type=\"button\" class=\"program-option-card is-primary\""),
  'finish measuring should be hidden until it can be used, not shown disabled');
assert.ok(!source.includes("data-program-action=\"finish-measuring\" '+(metrics.measureDays.length?'':'disabled')"),
  'finish measuring should not appear as an unexplained disabled control');
assert.ok(source.includes("options.scrollIntoView({behavior:'smooth',block:'start',inline:'nearest'})"),
  'opening measure options should bring the controls into view');
assert.ok(source.includes('window.fox2SetInitialPage(activeProgram?0:1)'),
  'every load during active Progress Tracking should route to Progress');
assert.ok(source.includes("params.get('program_share')||''"),
  'a shared program snapshot should load from its URL');
assert.ok(source.includes("params.get('program_demo')||''"),
  'an interactive Progress Tracking demo should load from its URL');
assert.ok(source.includes('fox2ProgramSnapshot=fox2SharedProgramSnapshot||fox2ProgramDemoSnapshot'),
  'shared and demo snapshots should use the same representative program state');
assert.ok(source.includes('fox2ProgramReadOnly=!!fox2SharedProgramSnapshot'),
  'only shared snapshots should be read-only');
assert.ok(source.includes("url.searchParams.delete('program_demo')"),
  'sharing the interactive demo should produce an ordinary read-only share URL');
assert.ok(source.includes("url.searchParams.set('program_share',encoded)"),
  'sharing from Progress should add the read-only snapshot to the results URL');
assert.ok(source.includes("var url = sharingProgram?fox2ProgramShareUrl():window.location.href"),
  'the always-available Share button should use a tracking-aware link on Progress');
assert.ok(source.includes('Shared FOX2 progress'),
  'receivers should be told that they are viewing shared progress');
assert.ok(source.includes('.program-shell.is-shared [data-program-action]'),
  'program mutation controls should be hidden in the shared view');
assert.ok(!source.includes('activeProgram&&returningFromSync'),
  'active-program routing should not depend on a sync-return query parameter');
assert.ok(source.includes("if('scrollRestoration' in history) history.scrollRestoration='manual'"),
  'browser scroll restoration should be disabled before the horizontal pager is laid out');
assert.ok(source.includes('<div class="scroll-x is-initializing" id="scroller">'),
  'the pager should remain hidden until its initial page is fixed');
assert.ok(source.includes("scroller.classList.remove('is-initializing')"),
  'the pager should be revealed only after its final scroll position is set');
assert.ok(source.includes("if(scroller.classList.contains('is-initializing')) return"),
  'restoration scroll events should be ignored while the initial page is settling');
assert.ok(source.includes('if(initialRouteLocked){'),
  'late browser restoration must not replace the program-selected initial page');
assert.ok(source.includes('if(initialRouteLocked) scroller.scrollLeft=initialPageIndex*scroller.clientWidth'),
  'a late restoration scroll should be returned to the selected initial page');
assert.ok(source.includes("scroller.addEventListener('touchstart',unlockInitialRoute"),
  'the initial route lock should end when the user deliberately interacts with the pager');
assert.ok(source.includes('initialRouteLocked=false;\n    scroller.scrollTo'),
  'explicit tab navigation should end the initial route lock');
assert.ok(!source.includes('[0,100,500,1200].forEach'),
  'initial routing should not use competing timed scroll corrections');
assert.ok(source.includes('(metrics.after-metrics.baseline)/metrics.baseline*100'),
  'the primary reward should be the cumulative action average versus baseline');
assert.ok(source.includes('function fox2AnimateMeasureRecap()'));
assert.ok(source.includes("prefers-reduced-motion: reduce"),
  'the recap animation should respect reduced-motion preferences');
assert.ok(source.includes("var explicitReplay=root.classList.contains('is-replaying')"),
  'an explicit replay should be distinguishable from the automatic recap');
assert.ok(source.includes("if(!explicitReplay&&window.matchMedia"),
  'an explicit replay should run even when automatic motion is reduced');
assert.ok(source.includes('.program-recap-sequence:not(.is-replaying) *'),
  'reduced-motion CSS should not suppress an explicitly requested replay');
assert.ok(source.includes("if(screen==='measure') window.setTimeout(fox2AnimateMeasureRecap,0)"),
  'the completed-day story should animate after the measure page renders');

console.log('program tests passed');
