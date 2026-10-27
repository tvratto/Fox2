const assert=require('assert');
const fs=require('fs');
const vm=require('vm');

const source=fs.readFileSync(__dirname+'/index.html','utf8');

function functionSource(name,nextName){
  const start=source.indexOf('function '+name+'(');
  const end=source.indexOf('function '+nextName+'(',start+1);
  return source.slice(start,end);
}

(function snapshotCodecWorksWithoutTextEncoder(){
  const codecSource=functionSource('fox2EncodeProgramSnapshot','fox2IsoOrBlank');
  const context={btoa,atob,encodeURIComponent,decodeURIComponent,JSON,parseInt};
  vm.runInNewContext(codecSource,context);
  const snapshot={v:1,program:{screen:'measure',action:'Walk after dinner — café'},days:[{date:'2026-10-26',score:138}]};
  const encoded=context.fox2EncodeProgramSnapshot(snapshot);
  assert.ok(encoded.length>0,'program snapshots should always encode to a URL payload');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(context.fox2DecodeProgramSnapshot(encoded))),snapshot,
    'program snapshots should round-trip without TextEncoder or TextDecoder');
})();

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
assert.ok(source.includes('See when your body is using fat for energy.'),
  'onboarding should begin with the metabolic meaning of the measurement');
assert.ok(source.includes('When your body uses more fat, acetone in your breath rises.'),
  'the product introduction should connect fat use to breath acetone');
assert.ok(source.includes('FOX2 measures that acetone and places your result on a Fat Use Zone scale from 1 to 10+.'),
  'the product introduction should connect breath acetone to the displayed Fat Use Zone scale');
assert.ok(source.includes('Higher zones mean more fat use.'),
  'the product introduction should explain how to interpret the scale');
assert.ok(source.includes('Use FOX2 without tracking'),
  'intro should expose a clear path outside Progress Tracking');
assert.ok(source.includes('Start Progress Tracking'));
assert.ok(source.includes("aria-label=\"Introduction '+active+' of 3\""),
  'the product story should use three focused cards');
assert.ok(source.includes('program-onboarding-card'),
  'the introduction should use card-based onboarding surfaces');
assert.ok(source.includes('program-card-leave-left'),
  'forward onboarding should slide the current card away');
assert.ok(source.includes("'continue-intro':'forward'"),
  'continuing from the FOX2 explanation should use the forward card transition');
assert.ok(source.includes('data-program-action="continue-intro"'));
assert.ok(source.includes('data-program-action="continue-day"'));
assert.ok(source.includes("'>Next</button>"),
  'onboarding cards should use concise Next navigation labels');
assert.ok(source.includes('function fox2StartAcetoneAnimation('),
  'the product card should include an animated acetone molecule');
assert.ok(source.includes('var FOX2_ONBOARDING_SPEED=1.5;'),
  'the onboarding demonstrations should play at the approved 1.5x speed');
assert.ok(source.includes('aspect-ratio:184 / 125;'),
  'the Fat Use Zone canvas should preserve the intended NOW-screen proportions');
assert.ok(source.includes('data-i="9"'),
  'the acetone model should include all carbon, oxygen, and hydrogen atoms');
assert.ok(source.includes('id="program-breath-zone-canvas"'),
  'the acetone molecule should transform into the Fat Use Zone');
assert.ok(source.includes('function fox2DayIntroHtml('),
  'onboarding should connect the daily graph to the Fat Use Score');
assert.ok(source.includes("fox2Program.screen='day-intro'"));
assert.ok(source.includes('Map how your fat use changes through the day.'),
  'the combined daily card should explain the purpose of repeated readings');
assert.ok(source.includes('Fat use rises and falls as your body’s needs change.'),
  'the combined daily card should explain why fat use changes during the day');
assert.ok(source.includes('Measure a few times a day, and FOX2 combines those readings into your daily Fat Use Score.'),
  'the combined daily card should actively explain how readings become a daily score');
assert.ok(source.includes('id="program-day-zone-source"'),
  'the NOW result should collapse into a point in the daily graph');
assert.ok(source.includes('id="program-day-ring-value"'),
  'the daily graph animation should resolve into a score ring');
assert.ok(source.includes('function fox2CompareIntroHtml('),
  'onboarding should explain the purpose of the Fat Use Baseline');
assert.ok(source.includes('See what changes your fat use.'));
assert.ok(source.includes('First, FOX2 learns your Fat Use Baseline.'),
  'the comparison card should explain that the baseline comes first');
assert.ok(source.includes('Then you can change your diet, exercise, medication, or routine.'),
  'the comparison card should give concrete examples of changes');
assert.ok(source.includes('FOX2 analyzes your daily scores to show how your fat use changed.'),
  'FOX2, rather than the user, should be responsible for analyzing the comparison');
[
  ['fox2StartAcetoneAnimation','fox2StartDayIntroAnimation'],
  ['fox2StartDayIntroAnimation','fox2StartCompareIntroAnimation'],
  ['fox2StartCompareIntroAnimation','fox2RenderProgram']
].forEach(function(pair){
  assert.ok(!functionSource(pair[0],pair[1]).includes('prefers-reduced-motion'),
    pair[0]+' should keep its instructional animation visible when card transitions are reduced');
});
assert.ok(source.includes("fox2Program.screen='compare-intro'"));
assert.ok(source.includes("}else if(action==='continue-day'){\n    fox2Program.screen='compare-intro';"),
  'the daily score card should lead directly to the before-and-after card');
assert.ok(source.includes("if(programPage) programPage.scrollTop=0;"),
  'each onboarding card should begin at the top of the Progress page');
assert.ok(source.includes('onclick="openGuideModal()"'),
  'the persistent Help control should open reusable help choices');
assert.ok(source.includes('FOX2 Help'));
assert.ok(source.includes('How FOX2 Works<span>Replay the three-part introduction.</span>'));
assert.ok(source.includes('How to Measure<span>Warmup, blowing, and measurement tips.</span>'));
assert.ok(source.includes('href="/guide/"'),
  'measurement help should remain available');
assert.ok(source.includes('data-guide-action="done">Done</button>'),
  'replay mode should end without entering Progress Tracking setup');
const replaySource=source.slice(source.indexOf('function openGuideModal('),source.indexOf("var fox2ProgramEnterDirection="));
assert.ok(!replaySource.includes('fox2Program.'),
  'replaying How FOX2 Works must not mutate Progress Tracking state');
assert.ok(!source.includes('function fox2BaselineIntroHtml()'),
  'the standalone starting-point explainer should not remain in the story');
assert.ok(!source.includes('function fox2IntroHtml()'),
  'the story should not repeat itself on a separate summary card');
assert.ok(source.includes('function fox2MethodHtml()'),
  'onboarding should offer a Fat Use Baseline choice before action setup');
assert.ok(source.includes('Measure my baseline'));
assert.ok(source.includes('Use a standard baseline'));
assert.ok(source.includes('var FOX2_STANDARD_BASELINE=75;'),
  'the standard starting point should be explicit and centralized');
assert.ok(source.includes('(a low Fat Use Baseline) and begin the 30-day program.'),
  'the standard baseline option should explain what the reference value represents');
assert.ok(source.includes("fox2Program.screen='first'"),
  'both starting-point paths should lead into the first-measurement handoff');
assert.ok(source.includes('function fox2FirstMeasurementHtml()'),
  'onboarding should walk the user through the first measurement and sync');
assert.ok(source.includes('Tap your phone to FOX2 again to sync it.'));
assert.ok(source.includes('Finish program and view result'));
assert.ok(source.includes('Restart program'));
assert.ok(source.includes('Start over with a new baseline'));
assert.ok(source.includes('function fox2SetProgramHistory(readingRows,scoreRows)'),
  'the program should retain complete score history beyond the current NFC payload');
assert.ok(source.includes("fox2SetProgramHistory(mergedHistoryReadings,mergedHistoryScores)"),
  'merged server and incoming history should be supplied to the guided program');
assert.ok(source.includes('var mergedHistoryReadings=pageIsCurrentOrNewer?historyReadings.concat(readingRows):historyReadings'),
  'the current NFC readings should be available before the asynchronous history write completes');
assert.ok(source.includes('var pageIsCurrentOrNewer = wsVal > storedWsVal'),
  'only a current or newer device payload should override stored history');
assert.ok(source.includes('mergedScoresByDate[String(row.day_date)]=row'),
  'daily scores should be merged by calendar date');
assert.ok(source.indexOf('writeScoreRows.forEach(function(row)')<source.indexOf("fox2SetProgramHistory(mergedHistoryReadings,mergedHistoryScores)"),
  'the incoming NFC scores should override stale stored scores before Progress re-renders');
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
assert.ok(source.includes('FOX2 recommends 7 days for a more representative Fat Use Baseline.'),
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
assert.ok(source.includes('var FOX2_PROGRAM_DAYS=FOX2_MEASURE_DAYS;'),
  'the visible 30-day program should begin after baseline preparation');
assert.ok(source.includes('30-Day Program'));
assert.ok(source.includes('>Measure</span>'));
assert.ok(source.includes('>Results</span>'));
assert.ok(!source.includes("phase='Measure · Day '"),
  'the progress block should not repeat the current measuring day');
assert.ok(source.includes("fox2DaysBetween(fox2Program.measureStart,fox2TodayIso())>=FOX2_MEASURE_DAYS"),
  'the program should advance to results after the 30-day measurement segment');
assert.ok(source.includes('Fat Use Baseline ready'));
assert.ok(source.includes('Start tracking'));
assert.ok(!source.includes("Yesterday's result"),
  'the first measuring day should not show an empty yesterday result');
assert.ok(source.includes("resultAction=fox2Escape(fox2Program.action||'Your actions')"));
assert.ok(!source.includes("completed '+(metrics.measureDays.length===1?'day':'days')+' included"),
  'the compact measure page should not repeat the completed-day count');
assert.ok(!source.includes('Continue your actions.'),
  'the compact measure page should not repeat generic next-step messaging');
assert.ok(source.includes('function fox2SignedPercent(value)'));
assert.ok(source.includes('function fox2MeasureDashboardHtml(metrics,options)'),
  'the measure page should present the completed-day recap and cumulative action progress');
assert.ok(source.includes('Today So Far'),
  'the first synced measurement should produce a genuine same-day progress state');
assert.ok(!source.includes('program-today-progress-label'),
  'the Today So Far heading should not repeat that the day is in progress');
assert.ok(!source.includes('Today is underway'),
  'the Today So Far card should not repeat that today is underway');
assert.ok(source.includes('class="program-today-grid"'),
  'the Today So Far ring and explanation should use the compact prototype layout');
assert.ok(source.includes('--today-color:var(--program-orange)'),
  'the Today So Far ring should use the program progress color');
assert.ok(source.includes('todayVisual.value/Math.max(1,Number(metrics.baseline)||FOX2_STANDARD_BASELINE)'),
  'the Today So Far ring should show progress toward the Fat Use Baseline');
assert.ok(source.includes('function fox2TodayProgramDay()'),
  'the same-day state should use the actual current calendar day rather than the last available day');
assert.ok(source.includes('function fox2TodayHistoryHtml(today,metrics)'),
  'the same-day state should include the live 30-day history chart');
assert.ok(source.includes("fox2TodayHistoryHtml(today,metrics)+'</div>"),
  'the live chart should appear directly below the Today So Far ring');
assert.ok(source.includes('var today=options.forceHistory?null:fox2TodayProgramDay()'),
  'a current-day reading should take priority over settled history during an active program');
assert.ok(source.includes('completedByDate[date]'),
  'the live today chart should preserve completed prior-day bars');
assert.ok(source.includes('program-today-history-current'),
  'the unfinished current-day bar should be visually distinct from completed days');
assert.ok(source.includes('Live · Day '),
  'the current unfinished bar should be identified as live rather than completed');
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
assert.ok(source.includes('day.date===model.latest.date'),
  'the newest completed day should land in its calendar position even when days are missing');
assert.ok(source.includes('missing:!completed&&i<completedBeforeToday'),
  'elapsed days without completed results should remain explicit gaps');
assert.ok(source.includes('program-recap-missing'),
  'missing days should look different from future chart positions');
assert.ok(source.includes("added to day '+model.latestDayNumber+' of your 30-day history"),
  'the recap should report the newest result’s calendar-day position, not its compacted result count');
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
assert.ok(source.includes('class="program-progress-result"'),
  'the cumulative result should occupy a fixed location in the program progress card');
assert.ok(source.includes("resultLabel=current==='results'?'Final Result':'Results So Far'"),
  'the fixed result should distinguish the completed program from an interim result');
assert.ok(source.includes('fox2MeasureDashboardHtml(metrics,{forceHistory:true})'),
  'the completed program should retain the full chart and final result summary');
assert.ok(source.includes('has increased your Fat Use Score by <span class="program-progress-result-change">'),
  'a positive result should explain what increased');
assert.ok(source.includes("var resultDuration='After '+day+' '+(day===1?'day':'days')+', '"),
  'the fixed result should state how far into the program the result was measured');
assert.ok(source.includes('class="program-progress-result-action"'),
  'the user’s chosen action should be highlighted in the fixed result statement');
assert.ok(source.includes('.program-progress-result p { margin:0; color:rgba(255,255,255,.82); font-size:19px'),
  'the fixed result should be the dominant text in the progress card');
assert.ok(source.includes('.program-progress .program-options-toggle { width:auto; min-height:32px; margin:5px 0 -7px'),
  'the options control should remain compact and left-aligned at the card bottom');
assert.ok(!source.includes('program-recap-summary" role="group"'),
  'the recap card should not duplicate the fixed result statement');
assert.ok(!source.includes('<div class="program-action-name"><span>Your actions</span>'));
assert.ok(!source.includes("Your score builds as the day continues."));
assert.ok(!source.includes('Measure as usual. Sync again tomorrow.'));
assert.ok(source.includes('class="program-options-anchor"'),
  'the program-options trigger should stay inside the fixed progress card');
assert.ok(source.includes('class="program-options-popover"'),
  'program options should open in a box anchored directly beneath the trigger');
assert.ok(source.includes('class="program-options-popover-close" data-program-action="toggle-options" aria-label="Close program options">×</button>'),
  'the anchored options box should have an explicit close control');
assert.ok(!source.includes('program-options-sheet'),
  'program options should no longer open in a detached bottom sheet');
assert.ok(!source.includes('>Tracking options '),
  'the old tracking-options trigger should not remain below the measure card');
assert.ok(source.includes("if(metrics.measureDays.length) optionButtons+='<button type=\"button\" class=\"program-option-card is-primary\""),
  'finish measuring should be hidden until it can be used, not shown disabled');
assert.ok(!source.includes("data-program-action=\"finish-measuring\" '+(metrics.measureDays.length?'':'disabled')"),
  'finish measuring should not appear as an unexplained disabled control');
assert.ok(source.includes("if(fox2ProgramOptionsOpen&&screen==='baseline')"),
  'measure-program options should not trigger page scrolling');
assert.ok(source.includes("options.scrollIntoView({behavior:'smooth',block:'start',inline:'nearest'})"),
  'opening baseline options should bring their inline controls into view');
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
assert.ok(source.includes("var url=new URL('/graphs/',window.location.origin)"),
  'shared links should always be built from the canonical graphs route');
assert.ok(source.includes("url.searchParams.set('share_v','2')"),
  'new share links should expose their share implementation version');
assert.ok(source.includes("['id','p','c'].forEach"),
  'shared links should retain stable device and user context');
assert.ok(source.includes("if(!url.searchParams.has('id'))"),
  'links without a stable device id should retain enough payload data to load');
assert.ok(source.includes("url.searchParams.set('program_share',encoded)"),
  'legacy self-contained program share links should remain readable');
assert.ok(source.includes("'/rest/v1/rpc/create_share_snapshot'"),
  'active Progress state should be prepared as an immutable server snapshot');
assert.ok(source.includes("'/rest/v1/rpc/get_share_snapshot'"),
  'a short token should retrieve its immutable server snapshot');
assert.ok(source.includes("fox2ProgramReadOnly&&/^[0-9a-f]{40}$/.test(fox2ShareToken)"),
  'an existing frozen share should be re-shareable without creating another snapshot');
assert.ok(!source.includes("if(fox2ProgramReadOnly||!fox2HasStartedProgram()) return Promise.resolve('')"),
  'legacy shared state should not prevent conversion to a short snapshot link');
assert.ok(source.includes("url.searchParams.set('share',token)"),
  'frozen snapshots should use a short token-only results URL');
assert.ok(source.includes("if(!fox2PreparedShareToken)"),
  'the Share button should refuse to send a program link before its snapshot is ready');
assert.ok(source.includes('function fox2InvalidatePreparedShare()'),
  'editing program state should invalidate an older prepared snapshot immediately');
assert.ok((source.match(/fox2InvalidatePreparedShare\(\);/g)||[]).length >= 2,
  'both program edits and refreshed history should invalidate an older prepared snapshot');
assert.ok(source.includes("fox2ProgramStorageKey()+':prepared-share'"),
  'a completed snapshot token should survive a page reload for unchanged program data');
assert.ok(source.includes('if(historyChanged){'),
  'an identical history refresh should not discard a ready snapshot token');
assert.ok(source.includes('Share link ready. Tap Share again.'),
  'a first tap during preparation should clearly tell the user when the link is ready');
assert.ok(source.includes("['ws','d','a','t','s','h','tz','v','p','c'].forEach"),
  'a frozen snapshot should contain the exact display payload without exposing a device id');
assert.ok(source.includes('if (fox2RemoteShareSnapshot || !dParam || totalDays === 0) return'),
  'opening a frozen snapshot must never write its embedded data back as live device data');
assert.ok(source.includes('var sharingProgram=fox2HasStartedProgram()'),
  'sharing should include active program state regardless of the visible pager index');
assert.ok(source.includes("return fox2Program.screen!=='overview'||!!fox2Program.action||!!fox2Program.baselineStart"),
  'program sharing should recognize state established beyond onboarding');
assert.ok(source.includes('sharingProgram?fox2FrozenShareUrl(fox2PreparedShareToken):fox2ResultsShareUrl()'),
  'the always-available Share button should use the prepared frozen link for active Progress');
assert.ok(source.includes("if(!fox2ValidShareUrl(url)) url=fox2ShareBaseUrl().toString()"),
  'the share handler should reject rewritten or UUID-style routes before invoking Messages');
assert.ok(source.includes('Shared FOX2 progress'),
  'receivers should be told that they are viewing shared progress');
assert.ok(source.includes('.program-shell.is-shared [data-program-action]'),
  'program mutation controls should be hidden in the shared view');
assert.ok(source.includes('.fox2-shared .tags { display:none!important; }'),
  'the Data tag tray should be hidden in a frozen shared view');
assert.ok(source.includes('if(fox2ProgramReadOnly||!_sbDeviceId)return;'),
  'a frozen shared view must never save data tags');
assert.ok(source.includes('function fox2FrozenAnalysisRows()'),
  'a frozen shared view should initialize Analysis from captured data');
assert.ok(source.includes('renderHistoricalAnalysis(frozenAnalysis.readings,frozenAnalysis.scores)'),
  'Analysis should resolve instead of waiting for a live-history request');
assert.ok(source.includes('analysis:{\n      readings:fox2ProgramHistoryReadings.slice(-500)'),
  'new frozen snapshots should include the history needed by Analysis');
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
assert.ok(source.includes("if(screen==='measure'||screen==='results') window.setTimeout(fox2AnimateMeasureRecap,0)"),
  'the completed-day story should animate after measure and final-results pages render');

console.log('program tests passed');
