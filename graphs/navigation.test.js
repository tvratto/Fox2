const assert=require('assert');
const fs=require('fs');

const source=fs.readFileSync(__dirname+'/index.html','utf8');

(function tabsExposeOneAccessiblePanelAtATime(){
  assert.ok(source.includes('role="tablist" aria-label="FOX2 results"'),
    'the results navigation should identify itself as a tab list');
  ['today','tracking','history','log'].forEach((name,index)=>{
    assert.ok(source.includes(`id="tab-${name}" role="tab"`),
      `${name} should expose a semantic tab`);
    assert.ok(source.includes(`id="panel-${name}" role="tabpanel" aria-labelledby="tab-${name}"`),
      `${name} should expose its matching tab panel`);
    if(index>0) assert.ok(source.includes(`aria-labelledby="tab-${name}" aria-hidden="true" inert hidden`),
      `${name} should begin outside the accessibility and focus trees`);
  });
  const app=fs.readFileSync(__dirname+'/app.js','utf8');
  assert.ok(app.includes("tab.setAttribute('aria-selected',active?'true':'false')"));
  assert.ok(app.includes("panel.setAttribute('aria-hidden',active?'false':'true')"));
  assert.ok(app.includes('panel.inert=!active'));
})();

(function tabsSupportKeyboardNavigation(){
  const app=fs.readFileSync(__dirname+'/app.js','utf8');
  assert.ok(app.includes("event.key==='ArrowLeft'")&&app.includes("event.key==='ArrowRight'"));
  assert.ok(app.includes("event.key==='Home'")&&app.includes("event.key==='End'"));
  assert.ok(app.includes('tabs[next].focus()'));
})();

console.log('navigation accessibility tests passed');
