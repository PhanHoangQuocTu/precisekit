import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertUnpublishedPackage } from './verify-release-registry.mjs';

const name = '@fatdevcon/precisekit';
const response = (status, metadata) => async () => ({ status, json: async () => metadata });

test('permits only an absent version in successful package metadata', async () => {
  await assertUnpublishedPackage(name, '0.5.2', async (url, options) => {
    assert.equal(url, 'https://registry.npmjs.org/%40fatdevcon%2Fprecisekit');
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers['Cache-Control'], 'no-cache');
    return { status: 200, json: async () => ({ name, versions: { '0.5.1': {} } }) };
  });
});

test('blocks existing versions regardless of their metadata value', async () => {
  for (const value of [{}, null]) {
    await assert.rejects(assertUnpublishedPackage(name, '0.5.1', response(200, { name, versions: { '0.5.1': value } })), /already published/);
  }
});

test('blocks all registry errors, including missing packages and authentication failures', async () => {
  for (const status of [301, 401, 403, 404, 429, 500, 503]) {
    await assert.rejects(assertUnpublishedPackage(name, '0.5.2', response(status)), new RegExp(`HTTP ${status}`));
  }
  await assert.rejects(assertUnpublishedPackage(name, '0.5.2', async () => { throw new Error('network unavailable'); }), /network unavailable/);
});

test('blocks malformed or mismatched metadata', async () => {
  for (const metadata of [null, {}, { name: 'another-package', versions: {} }, { name, versions: [] }, { name, versions: 'invalid' }]) {
    await assert.rejects(assertUnpublishedPackage(name, '0.5.2', response(200, metadata)), /Invalid npm registry metadata/);
  }
  await assert.rejects(assertUnpublishedPackage(name, '0.5.2', async () => ({ status: 200, json: async () => { throw new SyntaxError('invalid JSON'); } })), /invalid JSON/);
});
