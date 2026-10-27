const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const source = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

[
  'Close export',
  'Close Squad Info',
  'Close FOX2 Help',
  'Close baseline confirmation',
  'Close note editor'
].forEach((label) => {
  assert.ok(
    source.includes(`class="modal-corner-close"`) && source.includes(`aria-label="${label}"`),
    `${label} should use the shared upper-right close control`
  );
});

assert.ok(source.includes("closeBtn.addEventListener('click',doCancel)"),
  'the note editor close control should use the existing cancel behavior');

console.log('modal tests passed');
