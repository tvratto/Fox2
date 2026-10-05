const assert=require('assert');
const fs=require('fs');

const syncSource=fs.readFileSync(__dirname+'/index.html','utf8');
const graphSource=fs.readFileSync(__dirname+'/../graphs/index.html','utf8');

const inlineScripts=[...syncSource.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map(match=>match[1]).filter(script=>script.trim());
assert.equal(inlineScripts.length,1);
assert.doesNotThrow(()=>new Function(inlineScripts[0]));

assert.ok(syncSource.includes("new URL('/graphs/',window.location.origin)"));
assert.ok(syncSource.includes("graphUrl.searchParams.set('sync','1')"));
assert.ok(syncSource.includes("channel.postMessage({type:'probe'"));
assert.ok(syncSource.includes("channel.postMessage({type:'updated'"));
assert.ok(syncSource.includes("window.location.replace(url)"));
assert.ok(syncSource.includes("window.open(resultsUrl(),'fox2-results-'"));

assert.ok(graphSource.includes("window.name='fox2-results-'"));
assert.ok(graphSource.includes("message.type==='probe'"));
assert.ok(graphSource.includes("message.type==='updated'"));
assert.ok(graphSource.includes('Promise.all(writePromises)'));
assert.ok(graphSource.includes("type:'fox2-sync-complete'"));

console.log('sync handoff tests passed');
