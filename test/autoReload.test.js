import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canAutoReload } from '../src/autoReload.js';

const memory = () => {
    const data = new Map();
    return {
        getItem: (k) => (data.has(k) ? data.get(k) : null),
        setItem: (k, v) => data.set(k, v),
    };
};

test('allows the first automatic reload and records it', () => {
    const storage = memory();
    assert.equal(canAutoReload('k', 1_000_000, storage), true);
    assert.equal(storage.getItem('k'), '1000000');
});

test('blocks another reload within a minute, so a persistent failure cannot loop', () => {
    const storage = memory();
    assert.equal(canAutoReload('k', 1_000_000, storage), true);
    assert.equal(canAutoReload('k', 1_059_999, storage), false);
});

test('allows a reload again after a minute', () => {
    const storage = memory();
    canAutoReload('k', 1_000_000, storage);
    assert.equal(canAutoReload('k', 1_060_000, storage), true);
});

test('keys are independent', () => {
    const storage = memory();
    canAutoReload('boot', 1_000_000, storage);
    assert.equal(canAutoReload('crash', 1_000_001, storage), true);
});

test('never reloads automatically when storage is unavailable', () => {
    const broken = {
        getItem: () => {
            throw new Error('denied');
        },
        setItem: () => {},
    };
    assert.equal(canAutoReload('k', 1_000_000, broken), false);
    assert.equal(canAutoReload('k', 1_000_000, undefined), false);
});
