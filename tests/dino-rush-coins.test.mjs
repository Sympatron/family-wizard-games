import test from 'node:test';
import assert from 'node:assert/strict';
import {COIN_VALUES, BASE_PICKUP_RANGE, MAX_PICKUP_RANGE, makeCoinWave, crossedCoin} from '../games/dino-rush-battle/runner/coins.js';

test('runner coins include distinct denominations and varied positions', () => {
    const values = new Set();
    const xPositions = new Set();
    let seed = 1234;
    const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 0x100000000);
    for (let i = 0; i < 100; i++) {
        const wave = makeCoinWave(random);
        assert.equal(wave.length, 3);
        for (const coin of wave) {
            values.add(coin.value);
            xPositions.add(coin.x);
            assert.ok(coin.x >= -4.8 && coin.x <= 4.8);
            assert.ok(coin.z <= -72);
        }
    }
    assert.deepEqual([...values].sort((a, b) => a - b), COIN_VALUES);
    assert.ok(xPositions.size > 40);
});
test('coins collect exactly once when crossing the player within reach', () => {
    assert.equal(crossedCoin(0.5, 8, 7.7, 8.3, 0.2), true);
    assert.equal(crossedCoin(0.5, 8, 7.7, 8.3, 3), false);
    assert.equal(crossedCoin(0.5, 8, 8.3, 8.7, 0.2), false);
    assert.equal(crossedCoin(0.5, 8, 7.1, 7.8, 0.2), false);
});

test('coins have a generous collection radius without collecting across the road', () => {
    assert.equal(crossedCoin(1.7, 8, 7.6, 8.3, 0), true);
    assert.equal(crossedCoin(-1.7, 8, 7.6, 8.3, 0), true);
    assert.equal(crossedCoin(1.9, 8, 7.6, 8.3, 0), false);
});

test('gate magnet range collects coins farther away but stays bounded', () => {
    assert.equal(BASE_PICKUP_RANGE, 1.8);
    assert.equal(MAX_PICKUP_RANGE, 4.5);
    assert.equal(crossedCoin(0, 8, 7.7, 8.3, 3), false);
    assert.equal(crossedCoin(0, 8, 7.7, 8.3, 3, 3.2), true);
    assert.equal(crossedCoin(0, 8, 7.7, 8.3, 5, MAX_PICKUP_RANGE), false);
});
