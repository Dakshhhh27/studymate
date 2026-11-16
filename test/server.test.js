const test = require('node:test');
const assert = require('node:assert');
const {validate, extractJson} = require('../server.js');

test('extractJson strips fences and prose', () => {
  assert.deepStrictEqual(extractJson('Sure!\n```json\n[{"q":"a","a":"b"}]\n```'), [{q: 'a', a: 'b'}]);
});
test('extractJson throws without JSON', () => assert.throws(() => extractJson('no json here')));
test('validate accepts a normal conversation', () => assert.strictEqual(validate({messages: [{role: 'user', content: 'hi'}]}), null));
test('validate rejects bad input', () => {
  assert.ok(validate({}));
  assert.ok(validate({messages: [{role: 'assistant', content: 'hi'}]}));
  assert.ok(validate({messages: [{role: 'user', content: 'x'.repeat(50000)}]}));
});
