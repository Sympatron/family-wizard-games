const STORAGE_KEY = 'dino-rush-sound-enabled';
let soundEnabled = true;
try { soundEnabled = globalThis.localStorage?.getItem(STORAGE_KEY) !== 'false'; } catch {}

export function isHitSoundEnabled() { return soundEnabled; }
export function setHitSoundEnabled(value) {
    soundEnabled = Boolean(value);
    try { globalThis.localStorage?.setItem(STORAGE_KEY, String(soundEnabled)); } catch {}
}

export function createHitSound() {
    const Context = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    let context = null;
    let lastHit = -Infinity;
    let disposed = false;
    function unlock() {
        if (!Context || disposed || !soundEnabled) return;
        try {
            context ??= new Context();
            if (context.state === 'suspended') void context.resume().catch(() => {});
        } catch {
            context = null;
        }
    }
    function hit(kind = 'impact') {
        if (disposed || !soundEnabled || context?.state !== 'running') return;
        const now = context.currentTime;
        if (now - lastHit < 0.045) return;
        lastHit = now;
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = ['break', 'shot'].includes(kind) ? 'sawtooth' : 'triangle';
        const start = {break: 480, upgrade: 600, shot: 950, coin: 780}[kind] ?? 280;
        const end = {break: 90, upgrade: 920, shot: 250, coin: 1150}[kind] ?? 90;
        const duration = kind === 'shot' ? 0.075 : 0.15;
        oscillator.frequency.setValueAtTime(start, now);
        oscillator.frequency.exponentialRampToValueAtTime(end, now + duration * 0.85);
        gain.gain.setValueAtTime(kind === 'break' ? 0.085 : kind === 'shot' ? 0.025 : 0.055, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(now);
        oscillator.stop(now + duration + 0.01);
    }
    function dispose() {
        disposed = true;
        if (context) void context.close().catch(() => {});
        context = null;
    }
    return {unlock, hit, dispose};
}
