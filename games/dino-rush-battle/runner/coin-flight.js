export const COIN_ATTRACT_SECONDS = 0.38;
export const COIN_COUNTER_SECONDS = 0.48;

export function interpolateCoinFlight(from, to, elapsed, duration) {
    if (!(duration > 0) || !Number.isFinite(elapsed)) throw new Error('Ungültige Münzanimation.');
    const t = Math.max(0, Math.min(1, elapsed / duration));
    const eased = 1 - (1 - t) ** 3;
    return {
        x: from.x + (to.x - from.x) * eased,
        y: from.y + (to.y - from.y) * eased,
        z: (from.z ?? 0) + ((to.z ?? 0) - (from.z ?? 0)) * eased
    };
}
