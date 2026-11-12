import test from 'node:test';
import assert from 'node:assert/strict';
import {MockBackend} from '../shared/mock-backend.js';

function setup() {
    const map = new Map();
    const storage = {
        getItem: key => map.get(key) ?? null,
        setItem: (key, value) => map.set(key, String(value)),
        removeItem: key => map.delete(key)
    };
    return new MockBackend({
        gameId: 'test',
        initialGame: {score: 0},
        storage,
        reducer: (game, action, {coins}) => ({game: {score: game.score + 1}, coins: coins - 5, message: action.type})
    });
}

test('mock game persistence, coin debit and idempotent actions', async () => {
    const backend = setup();
    const original = await backend.load();
    assert.equal(original.coins, 250);
    const action = {id: 'request-1', type: 'play'};
    const first = await backend.execute(action);
    assert.equal(first.coins, 245);
    assert.equal(first.game.score, 1);
    assert.deepEqual(await backend.execute(action), first);
    await assert.rejects(backend.execute({id: 'request-1', type: 'different'}));
    assert.equal((await backend.load()).game.score, 1);
});

test('developer tools may edit arbitrary state and import/export scenarios', async () => {
    const backend = setup();
    backend.setCoins(10000);
    backend.setGameState({score: 700, inventory: ['wand']});
    const scenario = backend.exportScenario();
    backend.reset();
    assert.equal((await backend.load()).coins, 250);
    backend.importScenario(scenario);
    assert.equal((await backend.load()).game.inventory[0], 'wand');
    assert.equal((await backend.load()).coins, 10000);
    backend.setUser('sam');
    assert.equal((await backend.load()).coins, 250);
});

test('mock controls simulate errors without changing game state', async () => {
    const backend = setup();
    backend.setControls({delayMs: 0, failNext: true});
    await assert.rejects(backend.execute({id: 'fail', type: 'play'}), /Netzwerkfehler/);
    assert.equal((await backend.load()).game.score, 0);
    assert.equal(backend.controls().failNext, false);
});
