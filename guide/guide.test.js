'use strict';

const assert=require('assert');
const fs=require('fs');
const source=fs.readFileSync(__dirname+'/index.html','utf8');

assert.ok(source.includes('<title>How to measure with FOX2</title>'));
assert.ok(source.includes('<h1>How to measure</h1>'));
assert.ok(source.includes('Turn on and start'));
assert.ok(source.includes('Warm up'));
assert.ok(source.includes('Take a deep breath and blow'));
assert.ok(source.includes('See your result'));
assert.ok(source.includes('Before you measure'));
assert.ok(source.includes('Back to FOX2'));
assert.ok(!source.includes('Find your metabolic balance'),
  'the practical help page should not duplicate the old product-story guide');

console.log('guide tests passed');
