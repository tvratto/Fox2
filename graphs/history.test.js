const assert=require('assert');
const fs=require('fs');
const vm=require('vm');

const source=fs.readFileSync(__dirname+'/index.html','utf8');
const start=source.indexOf('function historyMondayWindowStart(');
const end=source.indexOf('function historyCalendarWeekDays(',start);
assert.ok(start>=0&&end>start,'history Monday anchor helper should exist');

const context={Date,Math};
vm.createContext(context);
vm.runInContext(source.slice(start,end),context);

const sundayStart=Date.parse('2026-09-13T00:00:00Z')/1000;
// Latest measured day is Sunday Oct 4 (index 21): rows begin Monday Sep 14.
assert.equal(context.historyMondayWindowStart(21,sundayStart,3),1);
// Latest measured day is Wednesday Sep 30 (index 17): same Monday anchor.
assert.equal(context.historyMondayWindowStart(17,sundayStart,3),1);
// A Monday current day creates a partial Monday–Sunday final row.
assert.equal(context.historyMondayWindowStart(22,sundayStart,3),8);

assert.ok(source.includes('var weekDays   = historyCalendarWeekDays(dayOffset)'));
assert.ok(source.includes('calcZoneTimes(Math.max(0, chunkStart))'));

console.log('history tests passed');
