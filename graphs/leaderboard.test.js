const assert=require('assert');
const fs=require('fs');
const vm=require('vm');

const source=fs.readFileSync(__dirname+'/index.html','utf8');
const start=source.indexOf('function leaderboardRecentPatterns(');
const end=source.indexOf('function fetchLeaderboard()',start);
assert.ok(start>=0&&end>start,'leaderboard recent-pattern helper should exist');

const context={Date,Number};
vm.createContext(context);
vm.runInContext(source.slice(start,end),context);

const devices=[
  {device_id:'A',_encodedLastMs:Date.parse('2026-10-15T18:00:00Z')},
  {device_id:'B',_encodedLastMs:Date.parse('2026-10-15T08:00:00Z')},
  {device_id:'C',_encodedLastMs:0},
  {device_id:'D',_encodedLastMs:Date.parse('2026-09-30T08:00:00Z')}
];
const scores=[
  {device_id:'A',day_date:'2026-09-30',auc_score:999}, // outside the window
  {device_id:'A',day_date:'2026-10-01',auc_score:80},
  {device_id:'A',day_date:'2026-10-07',auc_score:100},
  {device_id:'A',day_date:'2026-10-14',auc_score:120},
  {device_id:'A',day_date:'2026-10-15',auc_score:500}, // active day is incomplete
  {device_id:'B',day_date:'2026-10-14',auc_score:60},
  {device_id:'B',day_date:'2026-10-15',auc_score:90},
  {device_id:'C',day_date:'2026-10-20',auc_score:null},
  {device_id:'D',day_date:'2026-09-28',auc_score:70} // corrected to Sep 29
];

const patterns=context.leaderboardRecentPatterns(scores,devices);
assert.equal(patterns.A.startDate,'2026-10-01');
assert.equal(patterns.A.endDate,'2026-10-14');
assert.equal(patterns.A.dayCount,3);
assert.equal(patterns.A.average,100);
assert.equal(patterns.B.average,60);
assert.equal(patterns.C.average,null);
assert.equal(patterns.C.dayCount,0);
assert.equal(patterns.D.endDate,'2026-09-29');
assert.equal(patterns.D.average,70);

assert.ok(source.includes("<div class=\"lb-score-sub\">recent pattern</div>"));
assert.ok(source.includes('var recentPatterns = leaderboardRecentPatterns(allScores, devList)'));
assert.ok(!source.includes('var todayScore = {}'));

console.log('leaderboard tests passed');
