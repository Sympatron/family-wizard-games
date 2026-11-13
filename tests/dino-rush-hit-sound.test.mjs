import test from 'node:test';
import assert from 'node:assert/strict';
import {createHitSound, isHitSoundEnabled, setHitSoundEnabled} from '../games/dino-rush-battle/core/hit-sound.js';

test('audio feedback stays optional when Web Audio is unavailable', () => {
    const original = globalThis.AudioContext;
    const originalWebkit = globalThis.webkitAudioContext;
    try {
        delete globalThis.AudioContext;
        delete globalThis.webkitAudioContext;
        const audio = createHitSound();
        assert.doesNotThrow(() => {audio.unlock(); audio.hit(); audio.dispose(); audio.hit();});
    } finally {
        globalThis.AudioContext = original;
        globalThis.webkitAudioContext = originalWebkit;
    }
});
test('audio unlocks on interaction, plays throttled hit tones and disposes', () => {
    const original = globalThis.AudioContext;
    const calls = [];
    class FakeAudioContext {
        constructor() {this.state = 'suspended'; this.currentTime = 1; this.destination = {};}
        resume() {this.state = 'running'; return Promise.resolve();}
        close() {calls.push('close'); return Promise.resolve();}
        createOscillator() {
            return {
                frequency: {setValueAtTime(value) {calls.push(['frequency', value]);}, exponentialRampToValueAtTime() {}},
                connect() {}, start() {calls.push('start');}, stop() {calls.push('stop');}
            };
        }
        createGain() {
            return {gain: {setValueAtTime() {}, exponentialRampToValueAtTime() {}}, connect() {}};
        }
    }
    try {
        globalThis.AudioContext = FakeAudioContext;
        const audio = createHitSound();
        audio.hit();
        assert.equal(calls.length, 0);
        audio.unlock();
        audio.hit();
        audio.hit();
        assert.equal(calls.filter(item => item === 'start').length, 1);
        audio.dispose();
        audio.hit();
        assert.equal(calls.filter(item => item === 'start').length, 1);
        assert.ok(calls.includes('close'));
    } finally {
        globalThis.AudioContext = original;
    }
});

test('sound can be muted and unmuted using the shared preference', () => {
    assert.equal(typeof isHitSoundEnabled, 'function');
    const initial = isHitSoundEnabled();
    try {
        setHitSoundEnabled(false);
        assert.equal(isHitSoundEnabled(), false);
        setHitSoundEnabled(true);
        assert.equal(isHitSoundEnabled(), true);
    } finally {
        setHitSoundEnabled(initial);
    }
});

test('shooting audio uses a short sawtooth effect and respects mute', () => {
    const original = globalThis.AudioContext;
    const started = [];
    class FakeAudioContext {
        constructor() {this.state = 'running'; this.currentTime = 5; this.destination = {};}
        createOscillator() {
            const instance = {type: 'sine', frequency: {setValueAtTime() {}, exponentialRampToValueAtTime() {}},
                connect() {}, start() {started.push(this.type);}, stop() {}};
            return instance;
        }
        createGain() {return {gain: {setValueAtTime() {}, exponentialRampToValueAtTime() {}}, connect() {}};}
        close() {return Promise.resolve();}
    }
    try {
        globalThis.AudioContext = FakeAudioContext;
        setHitSoundEnabled(true);
        const player = createHitSound();
        player.unlock();
        player.hit('shot');
        assert.deepEqual(started, ['sawtooth']);
        setHitSoundEnabled(false);
        player.hit('shot');
        assert.deepEqual(started, ['sawtooth']);
        player.dispose();
    } finally {
        setHitSoundEnabled(true);
        globalThis.AudioContext = original;
    }
});
