import test from 'node:test';
import assert from 'node:assert/strict';
import {createRunnerNotice} from '../games/dino-rush-battle/runner/notices.js';

test('runner notices show and automatically expire', () => {
    const notices = createRunnerNotice(2);
    assert.equal(notices.text, '');
    notices.show('Raptor befreit!');
    notices.tick(0.75);
    assert.equal(notices.text, 'Raptor befreit!');
    notices.tick(1.25);
    assert.equal(notices.text, '');
});
test('new gate feedback replaces older rescue messages', () => {
    const notices = createRunnerNotice(2);
    notices.show('Raptor befreit!');
    notices.tick(1.8);
    notices.show('SCHADEN +2: 1 → 2');
    notices.tick(0.3);
    assert.match(notices.text, /SCHADEN/);
    notices.tick(1.7);
    assert.equal(notices.text, '');
    assert.throws(() => notices.tick(-1));
    assert.throws(() => createRunnerNotice(0));
});
