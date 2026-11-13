export const MAX_BULLETS = 5;
export function volleyPattern(count, totalDamage) {
    if (!Number.isInteger(count) || count < 1 || count > MAX_BULLETS || !(totalDamage > 0) || !Number.isFinite(totalDamage)) {
        throw new Error('Ungültige Schusswerte.');
    }
    return Array.from({length: count}, (_, index) => {
        const offset = index - (count - 1) / 2;
        return {
            offset: offset * 0.26,
            spread: offset * 0.022,
            damage: totalDamage / count
        };
    });
}

export function initialRunnerWeaponStats(upgrades = {}) {
    const permanent = Number(upgrades.runnerDamage) || 0;
    return {damage: Math.max(0.3, Math.min(3, 1 + Math.max(0, permanent) * 0.12)), fireRate: 1, bullets: 1};
}
