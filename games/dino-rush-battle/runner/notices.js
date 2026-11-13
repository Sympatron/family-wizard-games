export function createRunnerNotice(duration = 2.5) {
    if (!(duration > 0)) throw new Error('Invalid notice duration');
    let text = '';
    let remaining = 0;
    return {
        show(value) {
            text = String(value);
            remaining = duration;
        },
        tick(dt) {
            if (dt < 0 || !Number.isFinite(dt)) throw new Error('Invalid elapsed time');
            remaining = Math.max(0, remaining - dt);
            if (remaining === 0) text = '';
        },
        get text() {return text;}
    };
}
