const assert=require('assert');
const fs=require('fs');

const syncSource=fs.readFileSync(__dirname+'/index.html','utf8');
const graphSource=fs.readFileSync(__dirname+'/../graphs/app.js','utf8');

const inlineScripts=[...syncSource.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map(match=>match[1]).filter(script=>script.trim());
assert.equal(inlineScripts.length,1);
assert.doesNotThrow(()=>new Function(inlineScripts[0]));
assert.doesNotThrow(()=>new Function(graphSource));

assert.ok(syncSource.includes("new URL('/graphs/',window.location.origin)"));
assert.ok(syncSource.includes("graphUrl.searchParams.set('sync','1')"));
assert.ok(syncSource.includes("data.type!=='fox2-sync-complete'"));
assert.ok(syncSource.includes("window.location.replace(url)"));

assert.ok(graphSource.includes('function setupSyncHandoff()'));
assert.ok(graphSource.includes("window.name='fox2-results-'"));
assert.ok(graphSource.includes("incoming.type==='probe'"));
assert.ok(graphSource.includes("incoming.type==='updated'"));
assert.ok(graphSource.includes("document.addEventListener('visibilitychange'"));
assert.ok(graphSource.includes("window.parent.postMessage({type:'fox2-sync-complete'"));
assert.ok(graphSource.includes('finishSyncHandoff(saved)'));

console.log('sync compatibility tests passed');
