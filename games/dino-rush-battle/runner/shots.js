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

export function initialRunnerWeaponStats(upgrades = {}, gunUpgrades = {}) {
    const permanent = Math.max(0, Number(upgrades.runnerDamage) || 0);
    const damage = Math.max(0.3, Math.min(3, 1 + permanent * 0.12)) + (gunUpgrades.damage ?? 0);
    const fireRate = 1 + (gunUpgrades.fireRate ?? 0) * 0.5 * SHOT_INTERVAL_SECONDS;
    const bullets = Math.min(MAX_BULLETS, 1 + (gunUpgrades.bullets ?? 0));
    return {damage, fireRate, bullets, pickupRange: BASE_PICKUP_RANGE};
}
