const assert=require('assert');
const fs=require('fs');
const vm=require('vm');

const syncSource=fs.readFileSync(__dirname+'/index.html','utf8');
const graphSource=fs.readFileSync(__dirname+'/../graphs/index.html','utf8');

const inlineScripts=[...syncSource.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map(match=>match[1]).filter(script=>script.trim());
assert.equal(inlineScripts.length,1);
assert.doesNotThrow(()=>new Function(inlineScripts[0]));

assert.ok(syncSource.includes("new URL('/graphs/',window.location.origin)"));
assert.ok(syncSource.includes("graphUrl.searchParams.set('sync','1')"));
assert.ok(syncSource.includes("url.searchParams.set('handoff','1')"));
assert.ok(syncSource.includes("channel.postMessage({type:'probe'"));
assert.ok(syncSource.includes("channel.postMessage({type:'updated'"));
assert.ok(syncSource.includes("window.location.replace(url)"));
assert.ok(!syncSource.includes("window.open(resultsUrl(),'fox2-results-'"));
assert.ok(syncSource.includes("channel.postMessage({type:'focus'"));
assert.ok(syncSource.includes('Close this sync tab to return'));

assert.ok(graphSource.includes("window.name='fox2-results-'"));
assert.ok(graphSource.includes("id=\"nfc-sync-handoff\""));
assert.ok(graphSource.includes("var canProbe=!!dParam"));
assert.ok(graphSource.includes("incoming.type==='probe'"));
assert.ok(graphSource.includes("incoming.type==='focus'"));
assert.ok(graphSource.includes("incoming.type==='updated'"));
assert.ok(graphSource.includes('Promise.all(writePromises)'));
assert.ok(graphSource.includes('window._fox2Handoff.reportWrites(ok)'));
assert.ok(graphSource.includes("type:'fox2-sync-complete'"));

(function legacyGraphUrlHandsOffToAnEstablishedResult(){
  const start=graphSource.indexOf('(function setupSyncHandoff(){');
  const end=graphSource.indexOf('// ─── Restore the latest saved device payload',start);
  const handoffSource=graphSource.slice(start,end);
  assert.ok(start>=0&&end>start);

  const channels={};
  class MockBroadcastChannel{
    constructor(name){this.name=name;this.listener=null;(channels[name]||(channels[name]=[])).push(this);}
    addEventListener(type,listener){if(type==='message')this.listener=listener;}
    postMessage(data){(channels[this.name]||[]).forEach(peer=>{if(peer!==this&&peer.listener)peer.listener({data});});}
  }
  function page(search){
    const elements={};
    ['nfc-sync-handoff','nfc-sync-mark','nfc-sync-title','nfc-sync-message','nfc-sync-return'].forEach(id=>{
      elements[id]={style:{},textContent:'',classList:{visible:false,add(){this.visible=true;},remove(){this.visible=false;}},addEventListener(){}};
    });
    const timers=[];
    const location={href:'https://fox2.info/graphs/'+search,replaced:'',replace(url){this.replaced=url;}};
    const window={location,name:'',open(){return {focus(){}}},close(){}};
    window.top=window;window.self=window;
    const context={
      window,document:{getElementById(id){return elements[id]||null;}},
      params:new URLSearchParams(search),dParam:'s:0010',BroadcastChannel:MockBroadcastChannel,
      URL,Math,Date,setTimeout(fn){timers.push(fn);return timers.length;}
    };
    vm.runInNewContext(handoffSource,context);
    return {window,elements,timers};
  }

  const established=page('?id=DEVICE1&d=s%3A0010&handoff=1');
  assert.equal(established.window._fox2Handoff.established,true);
  const incoming=page('?id=DEVICE1&d=s%3A0010');
  assert.equal(incoming.window._fox2Handoff.existing,true);
  incoming.timers.splice(0).forEach(timer=>timer());
  assert.equal(incoming.window._fox2Handoff.established,false);
  incoming.window._fox2Handoff.reportWrites(true);
  assert.ok(established.window.location.replaced.includes('handoff=1'));
  assert.equal(incoming.elements['nfc-sync-title'].textContent,'Your FOX2 is synced');
  assert.equal(incoming.elements['nfc-sync-return'].style.display,'block');

  const firstPage=page('?id=DEVICE2&d=s%3A0010');
  assert.equal(firstPage.window._fox2Handoff.existing,false);
  firstPage.timers.splice(0).forEach(timer=>timer());
  assert.equal(firstPage.window._fox2Handoff.established,true);
  assert.equal(firstPage.elements['nfc-sync-handoff'].classList.visible,false);
})();

console.log('sync handoff tests passed');
