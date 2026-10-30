const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const copyGenerator=require('./copy-generator.js');

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

(function progressUsesCanonicalScoresInsteadOfASecondResultSummary(){
  const context={fox2Program:{measureStart:'2026-10-26',action:'Oatmeal for breakfast',resultHistory:[
    {id:'2026-10-26|Add a walk after eating',action:'Add a walk after eating',before:75,after:125,change:67,date:'2026-10-28'}
  ]}};
  vm.runInNewContext(functionSource('fox2CurrentProgramResult','fox2ProgramMetrics'),context);
  assert.strictEqual(context.fox2CurrentProgramResult().action,'Add a walk after eating',
    'the saved result must retain its original action even if a draft previously overwrote the live label');

  Object.assign(context,{fox2LastProgressAnimationKey:'',fox2Escape:value=>String(value),fox2Round:value=>Math.round(value),
    fox2TodayIso:()=> '2026-10-29',fox2IsoOrBlank:value=>String(value||''),
    fox2DaysBetween:(start,end)=>Math.floor((Date.parse(end+'T00:00:00Z')-Date.parse(start+'T00:00:00Z'))/86400000),
    fox2AddIsoDays:(iso,amount)=>new Date(Date.parse(iso+'T00:00:00Z')+amount*86400000).toISOString().slice(0,10),
    fox2ShortDate:iso=>iso,fox2Mean:values=>values.reduce((sum,value)=>sum+Number(value||0),0)/values.length,
    fox2TodayProgramDay:()=>({date:'2026-10-29',score:94,readings:3}),
    fox2AllCompletedScoreDays:()=>[{date:'2026-10-27',score:72},{date:'2026-10-28',score:96}],
    fox2RingVisual:score=>({value:Math.round(score),color:'#4ADE80',progress:Math.min(1,score/120)}),
    Fox2CopyGenerator:copyGenerator,Math,Date,isFinite});
  vm.runInNewContext(functionSource('fox2ResolveProgressMessage','fox2ProgressHtml'),context);
  vm.runInNewContext(functionSource('fox2ProgressHtml','fox2SimpleProgressChartHtml'),context);
  const html=context.fox2ProgressHtml({baseline:75,after:125,measureDays:[{score:125}],elapsedDays:3,savedResult:context.fox2CurrentProgramResult()});
  assert.ok(html.includes('Today’s Fat Use Score')&&html.includes('30-Day Progress'),
    'Progress should move from the synced daily ring into the canonical daily bars');
  assert.ok(html.includes('BASELINE 75')&&html.includes('Oatmeal for breakfast'),
    'Progress should compare daily Scores directly while identifying the dated lifestyle change');
  assert.ok(html.includes('It’s only been a few days, but since starting Oatmeal for breakfast, your Fat Use Score is already higher.')&&html.includes('program-canonical-hero-value">12%')&&html.includes('program-canonical-hero-label">ABOVE BASELINE'),
    'an early result should name the active action and show its percentage impact as a directional hero result');
  assert.ok(html.includes('data-program-action="open-past-results">Past results</button>')&&!html.includes('Add a walk after eating'),
    'Progress should keep prior changes behind one quiet Past results link rather than lengthening the main card');
  const content={innerHTML:'',querySelectorAll(){return[];}},edit={textContent:'',hidden:false,setAttribute(){}},undo={hidden:true};
  const overlay={classList:{add(){}},querySelector(){return null;}};
  context.document={getElementById:id=>id==='past-results-content'?content:id==='past-results-edit'?edit:id==='past-results-undo'?undo:overlay};
  Object.assign(context,{fox2ProgramReadOnly:false,fox2PastResultsEditing:false,fox2PastResultsUndo:null,fox2PastResultsUndoTimer:0,
    fox2SaveProgram(){},window:{clearTimeout(){},setTimeout(){return 1;}}});
  vm.runInNewContext(functionSource('fox2RenderPastResults','fox2ClosePastResults'),context);
  context.fox2OpenPastResults();
  assert.ok(content.innerHTML.includes('Add a walk after eating')&&content.innerHTML.includes('2026-10-26–2026-10-28')&&content.innerHTML.includes('↑ 67%'),
    'Past results should retain each change, its full date range, and its directional percentage impact');
  context.fox2DeletePastResult(0);
  assert.strictEqual(context.fox2Program.resultHistory.length,0,'deleting a past result should remove only its saved comparison record');
  context.fox2UndoPastResultDelete();
  assert.strictEqual(context.fox2Program.resultHistory.length,1,'Undo should restore the deleted comparison in its original position');

  context.fox2Program={measureStart:'',action:'',resultHistory:[]};
  const openHtml=context.fox2ProgressHtml({baseline:0,measureDays:[],elapsedDays:0,savedResult:null});
  assert.ok(openHtml.includes('It’s still early, but your recent Fat Use Score is higher than your first completed Score.')&&openHtml.includes('program-canonical-hero-value">33%'),
    'measurements without a baseline or change should still produce a useful neutral Progress state');
  assert.ok(openHtml.includes('Want to see what affects your fat use?')&&openHtml.includes('Set up a baseline'),
    'the neutral Progress state should offer one clear baseline setup prompt');
  assert.ok(!openHtml.includes('BASELINE ')&&!openHtml.includes('Past results'),
    'the neutral state should not invent a baseline or attributed change result');
})();

(function progressMessageStateMachineCoversCoreStates(){
  const context={Fox2CopyGenerator:copyGenerator};
  vm.runInNewContext(functionSource('fox2ResolveProgressMessage','fox2ProgressHtml'),context);
  const resolve=context.fox2ResolveProgressMessage;
  assert.strictEqual(resolve({completedDays:[],today:null}).state,'empty');
  assert.strictEqual(resolve({completedDays:[],today:{score:62},baseline:75}).state,'accumulating');
  assert.strictEqual(resolve({completedDays:[{score:85}],action:'Zepbound 0.25 mg'}).state,'first-result');
  assert.strictEqual(resolve({completedDays:[{score:72},{score:96}],baseline:75,action:'Zepbound 0.25 mg'}).summary,
    'It’s only been a few days, but since starting Zepbound 0.25 mg, your Fat Use Score is already higher.');
  assert.strictEqual(resolve({completedDays:[{score:90},{score:96},{score:102},{score:108}],baseline:75,action:'Zepbound 0.25 mg'}).summary,
    'Great—your Fat Use Score is averaging higher since starting Zepbound 0.25 mg.');
  assert.strictEqual(resolve({completedDays:[{score:80},{score:100}],baseline:0,action:''}).summary,
    'It’s still early, but your recent Fat Use Score is higher than your first completed Score.');
})();

(function newActionStartsOnlyWhenConfirmed(){
  const program={screen:'setup',setupMode:'change',action:'Add a walk after eating',baselineMode:'default'};
  const context={fox2ProgramReadOnly:false,fox2Program:program,fox2ActionDraft:'Oatmeal for breakfast',
    FOX2_MEASURE_DAYS:30,fox2ProgramOptionsOpen:false,document:{getElementById:id=>id==='program-action-input'?{value:'Oatmeal for breakfast'}:null},
    fox2ProgramMetrics:()=>({}),fox2TodayIso:()=> '2026-10-28',fox2Round:value=>value,
    fox2SaveProgram:()=>{},fox2RenderProgram:()=>{}};
  vm.runInNewContext(functionSource('fox2HandleProgramAction','fox2RouteInitialPage'),context);
  context.fox2HandleProgramAction('begin');
  assert.strictEqual(program.action,'Oatmeal for breakfast');
  assert.strictEqual(program.measureStart,'2026-10-28');
  assert.strictEqual(program.screen,'measure',
    'confirming a changed action should begin a fresh program rather than remain on Final Result');
})();

(function extendTrackingResumesOrAddsFifteenDays(){
  function run(elapsedDays){
    const result={id:'2026-10-01|Walk after eating',action:'Walk after eating',change:18};
    const program={screen:'results',setupMode:'new',action:'Walk after eating',measureStart:'2026-10-01',targetDays:30,resultHistory:[result]};
    const context={fox2ProgramReadOnly:false,fox2Program:program,fox2ActionDraft:'',FOX2_MEASURE_DAYS:30,
      fox2ProgramOptionsOpen:true,document:{getElementById:()=>null},fox2ProgramMetrics:()=>({elapsedDays}),
      fox2CurrentProgramResult:()=>result,fox2ProgramTargetDays:()=>program.targetDays,
      fox2SaveProgram:()=>{},fox2RenderProgram:()=>{}};
    vm.runInNewContext(functionSource('fox2HandleProgramAction','fox2RouteInitialPage'),context);
    context.fox2HandleProgramAction('extend-tracking');
    return program;
  }
  const early=run(3);
  assert.strictEqual(early.targetDays,30,'ending early and extending should continue toward the original day 30');
  assert.strictEqual(early.screen,'measure');
  assert.strictEqual(early.resultHistory.length,0,'the temporary early result should resume as a live result');
  const complete=run(30);
  assert.strictEqual(complete.targetDays,45,'extending a completed 30-day program should add 15 days');
  assert.strictEqual(complete.screen,'measure');
})();

(function oneReadingDayStillCounts(){
  const context={
    fox2ProgramSnapshot:null,
    fox2ProgramHistoryReadings:[],
    fox2ProgramHistoryScores:[],
    fox2ProgramHistoryDays:[],
    addIsoDays:date=>date,
    fox2InvalidatePreparedShare:()=>{},
    fox2PrepareFrozenShare:()=>{}
  };
  vm.runInNewContext(functionSource('fox2SetProgramHistory','fox2AllCompletedScoreDays'),context);
  context.fox2SetProgramHistory(
    [{reading_ts:'2026-10-27T08:00:00Z',ppm:3.2}],
    [{day_date:'2026-10-27',auc_score:77}]
  );
  assert.deepStrictEqual(JSON.parse(JSON.stringify(context.fox2ProgramHistoryDays)),[
    {date:'2026-10-27',score:77}
  ],'a saved score from one measurement should count as a measured program day');
})();

(function freshDeviceSetupOpensCleanOnboardingAndPreservesPriorProgram(){
  const storage={
    'fox2-program-v1:DEVICE01':JSON.stringify({screen:'measure',action:'Old program',resultHistory:[]})
  };
  const localStorage={
    getItem:key=>Object.prototype.hasOwnProperty.call(storage,key)?storage[key]:null,
    setItem:(key,value)=>{storage[key]=String(value);}
  };
  const context={
    params:{get:key=>({id:'DEVICE01',setup:'fresh-token'}[key]||'')},
    localStorage,
    FOX2_PROGRAM_VERSION:1,
    FOX2_MEASURE_DAYS:30,
    fox2ProgramSnapshot:null,
    fox2IsSetupEntry:true,
    fox2SetupToken:'fresh-token',
    fox2ProgramReadOnly:false,
    Date,
    JSON,
    isFinite
  };
  const start=source.indexOf('function fox2ProgramStorageKey(');
  const end=source.indexOf('function fox2ApplyProgramRecoveryParam(',start);
  vm.runInNewContext(source.slice(start,end),context);
  assert.strictEqual(context.fox2Program.screen,'overview',
    'a new physical setup token should open the onboarding introduction');
  assert.strictEqual(JSON.parse(storage['fox2-program-v1:DEVICE01:previous']).program.action,'Old program',
    'a prior local program should remain recoverable after a fresh setup handoff');
  assert.strictEqual(storage['fox2-program-v1:DEVICE01:setup-token'],'fresh-token');
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
assert.ok(source.includes('existing:false,decided:!canProbe'),
  'a stale Safari presence timestamp must not make the new sync page close itself');
assert.ok(source.includes('answers the live BroadcastChannel probe'),
  'only a live response from another FOX2 tab should trigger the handoff');
assert.ok(source.includes('},900);'),
  'the Safari handoff should allow a background results tab time to answer');
assert.ok(source.includes('var activeProgram=fox2ProgramReadOnly||!fox2Program.optedOut'),
  'completed programs should continue opening on their Final Result');
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
assert.ok(source.includes('Demo Mode<span>Explore FOX2 with example progress and past results.</span>')&&source.includes('function openFox2DemoMode()'),
  'Help should provide a clear entry into the live example-data demo');
assert.ok(source.includes("sessionStorage.setItem('fox2-demo-return-url',window.location.href)"),
  'opening Demo Mode should remember the exact live results page');
assert.ok(source.includes('function fox2CloseDemo()')&&source.includes('>Close demo</button>'),
  'the demo banner should offer a clear return to the saved live results page');
assert.ok(source.includes('Restore Last Session<span>Undo the most recent restart or new-baseline choice.</span>'),
  'Help should expose recovery when a previous program session is available');
assert.ok(!source.includes('<button type="button" class="export-modal-close" onclick="closeGuideModal()">Close</button>'),
  'the Help menu should use only its upper-right close control');
assert.ok(source.includes('restore.hidden=fox2ProgramReadOnly||!fox2LoadProgramBackup()'),
  'Restore Last Session should only appear when a local recovery exists');
assert.ok(source.includes('.guide-choice[hidden] { display:none; }'),
  'the conditional restore entry should remain hidden when no recovery exists');
assert.ok(source.includes('function openFox2RestoreGuideConfirm()'),
  'Help recovery should require a focused confirmation');
assert.ok(source.includes('Replace the current Progress Tracking setup with the session saved before your most recent restart or baseline change?'),
  'the confirmation should explain exactly what restoration replaces');
assert.ok(source.includes('function restoreFox2LastSession()'),
  'the Help recovery action should restore the protected program backup');
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
assert.ok(source.includes('Measure for about a week before beginning your action.'),
  'the recommended baseline option should describe the timing in plain language');
assert.ok(source.includes('Choose a default baseline'));
assert.ok(source.includes('Enter another score'));
assert.ok(!source.includes('toggle-baseline-alternatives')&&!source.includes('program-baseline-alternatives'),
  'all baseline choices should remain visible without a disclosure control');
assert.ok(source.includes('program-method-title-row')&&source.includes('program-method-group'),
  'baseline choices should use one compact grouped list');
assert.ok(source.includes('var FOX2_STANDARD_BASELINE=75;'),
  'the standard starting point should be explicit and centralized');
assert.ok(source.includes('var FOX2_DEFAULT_BASELINES=[75,120,180];'),
  'onboarding and active-program settings should share the approved default baselines');
assert.ok(source.includes('Reference values—not goals.'),
  'the defaults should not be mistaken for program targets');
assert.ok(source.includes('A saved firmware score is a measured day even when it came from one'),
  'one-reading days should count toward baseline and program progress');
assert.ok(source.includes("var fox2SetupToken = params.get('setup') || ''"),
  'the hosted app should recognize the device first-use handoff');
assert.ok(source.includes("var fox2IntroComplete = params.get('intro') === '1'"),
  'legacy first-measurement links should remain readable during firmware rollout');
assert.ok(source.includes('if(fox2IntroComplete) fallback.firstMeasurementSynced=true;'),
  'a legacy first-measurement link should enter the ordinary synced Progress experience');
assert.ok(source.includes('data-progress-animate="'),
  'a sync should use the same Score-ring-to-bars transition on every measurement');
assert.ok(source.includes('Today’s Fat Use Score')&&source.includes('30-Day Progress'),
  'the web handoff should show the daily Score ring and then the canonical daily bars');
assert.ok(!source.includes("if(fox2IntroComplete){fallback.screen='first-sync'"),
  'first sync must not route to a one-off result screen');
assert.ok(source.includes('function fox2AwaitingFirstHtml()'),
  'an early NFC tap should show a dedicated waiting state');
assert.ok(source.includes('Complete your first measurement on FOX2.'),
  'an early tap should return attention to the independent device workflow');
assert.ok(source.includes("((!dParam || totalDays === 0) && !fox2IsSetupEntry)"),
  'a setup handoff with no measurements should not fall into the generic no-data screen');
assert.ok(!source.includes('readingCounts[date]!=null&&readingCounts[date]<2'),
  'the web app must not reject a saved daily score because it sees fewer than two readings');
assert.ok(!source.includes('Array.isArray(day.pts)&&day.pts.length<2'),
  'compressed NFC point counts must not invalidate a saved daily score');
assert.ok(source.includes("data-program-action=\"method-next\""),
  'choosing a baseline should be distinct from continuing onboarding');
assert.ok(source.includes('data-program-action="cancel-baseline">Cancel setup</button>'),
  'baseline setup should expose an explicit cancellation path');
assert.ok(source.includes("}else if(action==='cancel-baseline'){"),
  'canceling baseline setup should return to the settled Progress state');
assert.ok(source.includes('.program-method-radio { display:block;'),
  'baseline choice markers should retain their circular dimensions');
assert.ok(source.includes('data-program-action="start">Set up a baseline</button>'),
  'baseline setup should remain optional and available from the settled bars');
assert.ok(source.includes("if(fox2FinalizeResult(metrics)){fox2Program.screen='results';fox2ProgramOptionsOpen=true;}"),
  'legacy program completion should continue saving its result data');
assert.ok(!source.includes('class="program-simple-change"'),
  'Progress should not add a second percentage-summary visual above the daily bars');
assert.ok(!source.includes('<section class="program-section"><h2 class="program-section-title">What do you want to do?</h2>'),
  'result choices should no longer be stranded at the bottom of the page');
assert.ok(source.includes("fox2SaveProgramBackup('change actions')"),
  'adding or changing actions should preserve the program that preceded it');
assert.ok(source.includes("if(input) input.addEventListener('input',function(){fox2ActionDraft=input.value;});"),
  'typing a proposed action should update only a draft');
assert.ok(!source.includes("if(input) fox2Program.action=input.value.trim();"),
  'a draft action must not relabel the completed program');
assert.ok(source.includes("fox2Program.action=(input?input.value:fox2ActionDraft).trim();"),
  'the new action should become current only when tracking is confirmed');
assert.ok(source.includes("fox2ActionDraft=fox2Program.action||'';fox2Program.setupMode='change';fox2Program.screen='setup'"),
  'changing actions should prefill the current action without changing it before confirmation');
assert.ok(source.includes('function fox2OpenBaselineEditor()'),
  'the active program should provide a focused baseline editor');
assert.ok(source.includes('data-program-action="open-program-options">Program options</button>'),
  'settled Progress should provide one quiet Program options link beneath the chart');
assert.ok(source.includes('id="program-options-overlay"')&&source.includes('program-options-row-label">Baseline')&&source.includes('program-options-row-label">Action'),
  'Program options should show the current baseline and action with focused change controls');
assert.ok(source.includes('function fox2OpenBaselineFromProgramOptions(){')&&source.includes('fox2OpenBaselineEditor();'),
  'changing the baseline from Program options should open the existing baseline editor');
assert.ok(!functionSource('fox2OpenProgramOptions','fox2CloseProgramOptions').includes('measure a new baseline'),
  'measuring a new baseline should not appear at the top level of Program options');
assert.ok(functionSource('fox2RenderBaselineEditor','fox2ReviewBaselineChange').includes('measure a new baseline'),
  'measuring a new baseline should remain nested inside the baseline-change menu');
assert.ok(source.includes('Your program results will be recalculated.'),
  'changing a baseline should explain its effect on existing results');
assert.ok(source.includes('function fox2BeginNewMeasuredBaseline()'),
  'measuring a new baseline should explicitly begin a new program');
assert.ok(source.includes('function fox2SaveProgramBackup(reason)'),
  'destructive program changes should preserve the prior program locally');
assert.ok(source.includes("fox2SaveProgramBackup('new baseline')"),
  'starting a new measured baseline should preserve the active program first');
assert.ok(source.includes("fox2SaveProgramBackup('restart baseline')")&&
  source.includes("fox2SaveProgramBackup('restart program')")&&
  source.includes("fox2SaveProgramBackup('start over')"),
  'every restart path should preserve a recoverable copy of the active program');
assert.ok(source.includes('data-program-action="restore-previous-program"'),
  'Program options should expose the most recent recoverable program');
assert.ok(source.includes('Undo and resume previous program'),
  'the replacement setup screen should expose an immediate undo');
assert.ok(source.includes('You are on Day '),
  'the new-baseline confirmation should identify the progress that would be ended');
assert.ok(source.includes('Keep current program')&&source.includes('End program and start baseline'),
  'the destructive confirmation should make canceling the prominent safe choice');
assert.ok(source.includes('function fox2ApplyProgramRecoveryParam()'),
  'a one-time recovery URL should be able to restore known program metadata');
assert.ok(source.includes("params.get('program_recover')"),
  'the recovery URL should use an explicit program recovery parameter');
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
assert.ok(!source.includes("readingCounts[date]!=null&&readingCounts[date]<2"),
  'historical days should remain usable when the person measured once');
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
assert.ok(source.includes("if(screen==='maintain'){\n    screen='results';"),
  'legacy maintenance sessions should return to their saved result automatically');
assert.ok(source.includes("}else if(action==='extend-tracking'||action==='maintain'){"),
  'the former maintenance action should migrate into Extend tracking');
assert.ok(source.includes('if(metrics.elapsedDays>=currentTarget) fox2Program.targetDays=currentTarget+15;'),
  'a completed program should extend by 15 days');
assert.ok(source.includes("fox2Program.screen='measure';fox2ProgramOptionsOpen=false;"),
  'extending should resume the active measuring experience');
assert.ok(!source.includes('function fox2MaintainHtml()'),
  'the redundant Keep going page should no longer exist');
assert.ok(!source.includes('Keep going</h1>'),
  'the unexplained Keep going state should not be shown');
assert.ok(source.includes('function fox2ProgramHistoryHtml(items,title)'),
  'past action results should use one consistent before, after, and change presentation');
assert.ok(source.includes('var FOX2_MEASURE_DAYS=30;'),
  'new programs should begin with a 30-day measurement segment');
assert.ok(source.includes('targetDays:FOX2_MEASURE_DAYS'),
  'each program should persist its own tracking duration');
assert.ok(source.includes("fox2Program.targetDays=currentTarget+15"),
  'extended programs should persist their longer duration');
assert.ok(source.includes("fox2DaysBetween(fox2Program.measureStart,fox2TodayIso())>=fox2ProgramTargetDays()"),
  'the program should advance to results after its current tracking duration');
assert.ok(source.includes('Fat Use Baseline ready'));
assert.ok(source.includes('Start tracking'));
assert.ok(!source.includes("Yesterday's result"),
  'the first measuring day should not show an empty yesterday result');
assert.ok(source.includes('function fox2SignedPercent(value)'));
assert.ok(source.includes('function fox2TodayProgramDay()'),
  'the same-day state should use the actual current calendar day rather than the last available day');
assert.ok(source.includes('function fox2RingVisual(score)'),
  'the web Score ring should retain the firmware graduating score scales');
assert.ok(source.includes("bands=[60,120,180,240]"),
  'the web ring should use the same graduating score scales as the device');
assert.ok(source.includes('class="program-canonical-progress')&&source.includes('class="program-history-chart"'),
  'Progress should use only the canonical Score ring and 30-day daily-score history');
assert.ok(source.includes('data-progress-animate="')&&source.includes("},1700);"),
  'the Score ring should transition automatically into the new bar');
assert.ok(source.includes('program-canonical-recap-popover')&&source.includes("'+barsView+ring+'"),
  'the recap should appear as a temporary overlay while the 30-day Progress view remains underneath');
assert.ok(source.includes('program-history-latest-marker')&&source.includes('program-recap-ring-unwind'),
  'the ring should unwind into a persistent marker beside the newest bar');
assert.ok(!source.includes('program-history-bar-rise'),
  'the newest bar should already be present underneath the recap instead of rising afterward');
assert.ok(source.includes("progressBars.removeAttribute('aria-hidden')")&&source.includes('recapOverlay.remove()'),
  'the recap overlay should leave one clean, accessible Progress view after its animation');
assert.ok(source.includes('program-history-bar')&&source.includes('stroke:var(--program-orange)'),
  'every daily score bar should use the established FOX2 web orange');
assert.ok(source.includes('program-history-today-outline')&&source.includes('stroke:#ffd84d'),
  'today’s unfinished bar should use a yellow outline instead of a text label');
assert.ok(!source.includes('program-history-today-label'),
  'today’s unfinished bar should not carry an awkward SO FAR label');
assert.ok(source.includes('--today-color:var(--program-orange)'),
  'the web Progress score ring should use the established FOX2 web orange');
assert.ok(source.includes('slotIndex<chartTarget')&&source.includes('30-Day Progress')&&source.includes('program-history-date'),
  'Progress should use one dated 30-day history chart');
assert.ok(source.includes('var slotDay=chartDays[slotIndex]||null'),
  'daily scores should fill the 30-day chart from left to right');
assert.ok(source.includes('y="211"')&&source.includes('viewBox="0 0 336 218"'),
  'the 30-day date labels should sit on the X-axis beneath the bars');
assert.ok(!source.includes('program-history-curve')&&!source.includes('curvePoints'),
  'the daily bars should stand on their own without a line connecting their tops');
assert.ok(source.includes('stroke-dasharray:3 5')&&source.includes('BASELINE '),
  'a baseline should be rendered as a dotted white reference across the chart');
assert.ok(source.includes('fox2ResolveProgressMessage')&&source.includes('program-canonical-hero')&&!source.includes('program-canonical-context')&&!source.includes('program-calendar-change-note'),
  'the current change and result should read as one concise narrative rather than separate boxes');
assert.ok(source.includes('data-program-action="open-past-results">Past results</button>')&&source.includes('id="past-results-overlay"'),
  'completed changes should open from a quiet Past results link beneath the chart');
assert.ok(source.includes('class="program-how-link" onclick="openGuideModal();openFox2WorksGuide()">How this works</button>'),
  'Progress should link directly to the existing FOX2 explanation beside its heading');
assert.ok(source.includes('Replay the three-part introduction.')&&source.includes('fox2RenderWorksGuide'),
  'How this works should reuse the established three-slide explanation rather than duplicate it');
assert.ok(source.includes('program-canonical-summary'),
  'Progress should lead with a large plain-language summary');
assert.ok(source.includes('copy-generator.js')&&source.includes("Fox2CopyGenerator.generateCopy('progress',input)"),
  'Progress should use the shared deterministic copy generator');
assert.ok(!source.includes("summary='You have '+shownDays.length")&&!source.includes("summaryDetail='Keep measuring and sync again after your first completed day.'"),
  'Progress summaries should not report measurement or day counts');
assert.ok(!source.includes('function fox2ResolveProgressMessage(input){\n  input=input||{};'),
  'Progress message rules should not be duplicated inside the page');
assert.ok(source.includes('.past-results-action { color:#fff; font-size:17px')&&source.includes('.past-results-impact { display:flex;')&&source.includes('font-size:25px'),
  'Past results should use phone-readable change names and prominent percentage impacts');
assert.ok(source.includes("arrow=change>0?'↑':(change<0?'↓':'→')")&&source.includes('.past-results-impact.is-up { color:var(--program-orange,#ff8c00); }'),
  'Past results should pair directional arrows with orange increases and neutral decreases');
assert.ok(source.includes('onclick="fox2TogglePastResultsEdit()"')&&source.includes("row.addEventListener('touchstart'")&&source.includes("row.addEventListener('touchend'"),
  'Past results should support both a discoverable Edit mode and swipe-left deletion');
assert.ok(source.includes('Deleting a result removes the saved comparison, not your FOX2 measurements.'),
  'deletion should explicitly preserve the underlying measurement history');
assert.ok(source.includes('function fox2UndoPastResultDelete()')&&source.includes('Result deleted')&&source.includes('>Undo</button>'),
  'a deleted result should remain recoverable through a brief Undo action');
assert.ok(source.includes('edit.hidden=!canEdit')&&source.includes('if(!content||fox2ProgramReadOnly) return;'),
  'shared read-only result views should not expose deletion controls');
assert.ok(!source.includes('program-previous-changes')&&!source.includes('What you’ve learned'),
  'completed-change records should no longer expand the main Progress card');
assert.ok(!source.includes('program-canonical-average'),
  'Progress should not repeat the chart with a separate average value');
assert.ok(source.includes('Want to see what affects your fat use?')&&source.includes('Set up a baseline'),
  'the baseline call to action should explain its purpose without forcing the comparison model');
assert.ok(source.includes('function fox2CurrentProgramResult()'),
  'finished programs should resolve the saved result belonging to the current program');
assert.ok(source.includes("String(history[j].id||'').indexOf(prefix)===0"),
  'a completed result should remain recoverable by program start date if a draft action corrupted the current label');
assert.ok(source.includes("var savedResult=(fox2Program.screen==='results'||fox2Program.screen==='maintain')?fox2CurrentProgramResult():null"),
  'finished programs should freeze their metrics at the saved result');
assert.ok(source.includes('savedResult:savedResult'),
  'the frozen result should be available to the final-result presentation');
assert.ok(source.includes('if(measureEnd) measureDays=measureDays.filter(function(day){return day.date<=measureEnd;})'),
  'later measurements must not change a previously finished program result');
assert.ok(!source.includes('program-recap-summary" role="group"'),
  'the recap card should not duplicate the fixed result statement');
assert.ok(!source.includes('<div class="program-action-name"><span>Your actions</span>'));
assert.ok(!source.includes("Your score builds as the day continues."));
assert.ok(!source.includes('Measure as usual. Sync again tomorrow.'));
assert.ok(!source.includes('program-options-sheet'),
  'program options should no longer open in a detached bottom sheet');
assert.ok(!source.includes('>Tracking options '),
  'the old tracking-options trigger should not remain below the measure card');
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
assert.ok(source.includes("var fox2DemoMode=params.get('demo')==='1'")&&source.includes('fox2BuildLiveDemoSnapshot()'),
  'the live page should provide a short, stable demo URL without a large encoded payload');
assert.ok(source.includes("action:'Walk after dinner'")&&source.includes("action:'Skip breakfast'")&&source.includes("action:'Zepbound 0.25 mg'"),
  'the stable demo should include three practical prior changes');
assert.ok(source.includes('change:23')&&source.includes('change:28')&&source.includes('change:34'),
  'the demo prior changes should show distinct, believable impacts');
assert.ok(source.includes('FOX2 demo')&&source.includes('>Reset</button>')&&source.includes('function fox2ResetDemo()'),
  'demo mode should be clearly labeled and recoverable after an interactive presentation');
assert.ok(source.includes('if(fox2ProgramReadOnly||fox2DemoMode) return;'),
  'demo interactions must not overwrite a user\'s saved program');
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
assert.ok(source.includes("['ws','d','a','t','s','h','tz','v','p','c','x','n'].forEach"),
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
assert.ok(source.includes('.fox2-shared .tags { opacity:.34; filter:grayscale(1); pointer-events:none!important; }'),
  'the Data tag tray should remain visible but muted and inactive in a frozen shared view');
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
