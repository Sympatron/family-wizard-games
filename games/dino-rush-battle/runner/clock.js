import {frameDeltaSeconds} from './timing.js';

export function createRunnerClock() {
    let previous = null;
    let paused = false;
    return {
        tick(timestamp) {
            const delta = paused ? 0 : frameDeltaSeconds(previous, timestamp);
            previous = timestamp;
            return delta;
        },
        pause() {
            paused = true;
            previous = null;
        },
        resume() {
            paused = false;
            previous = null;
        },
        get paused() { return paused; }
    };
}
