const assert=require('assert');
const fs=require('fs');

const source=fs.readFileSync(__dirname+'/index.html','utf8');

(function tabsExposeOneAccessiblePanelAtATime(){
  assert.ok(source.includes('role="tablist" aria-label="FOX2 results"'),
    'the results navigation should identify itself as a tab list');
  ['progress','data','history','analysis'].forEach((name,index)=>{
    assert.ok(source.includes(`id="tab-${name}" role="tab"`),
      `${name} should expose a semantic tab`);
    assert.ok(source.includes(`id="panel-${name}" role="tabpanel" aria-labelledby="tab-${name}"`),
      `${name} should expose its matching tab panel`);
    if(index>0) assert.ok(source.includes(`aria-labelledby="tab-${name}" aria-hidden="true" inert`),
      `${name} should begin outside the accessibility and focus trees`);
  });
  assert.ok(source.includes("tabs[i].setAttribute('aria-selected',active?'true':'false')"));
  assert.ok(source.includes("pagePanels[i].setAttribute('aria-hidden',active?'false':'true')"));
  assert.ok(source.includes("pagePanels[i].toggleAttribute('inert',!active)"));
})();

(function tabsSupportKeyboardNavigation(){
  assert.ok(source.includes("event.key!=='ArrowLeft'")&&source.includes("event.key!=='ArrowRight'"));
  assert.ok(source.includes("event.key==='Home'")&&source.includes("event.key==='End'"));
  assert.ok(source.includes('tabs[idx].focus()'));
})();

console.log('navigation accessibility tests passed');
