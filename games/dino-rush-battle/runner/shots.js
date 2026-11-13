import {BASE_PICKUP_RANGE} from './coins.js';
export const MAX_BULLETS = 5;
export const SHOT_INTERVAL_SECONDS = 0.28;
export function volleyPattern(count, damagePerBullet) {
    if (!Number.isInteger(count) || count < 1 || count > MAX_BULLETS || !(damagePerBullet > 0) || !Number.isFinite(damagePerBullet)) {
        throw new Error('Ungültige Schusswerte.');
    }
    return Array.from({length: count}, (_, index) => {
        const offset = index - (count - 1) / 2;
        return {
            offset: offset * 0.26,
            spread: offset * 0.022,
            damage: damagePerBullet
        };
    });
}

export function initialRunnerWeaponStats(upgrades = {}) {
    const permanent = Number(upgrades.runnerDamage) || 0;
    return {damage: Math.max(0.3, Math.min(3, 1 + Math.max(0, permanent) * 0.12)), fireRate: 1, bullets: 1, pickupRange: BASE_PICKUP_RANGE};
}
