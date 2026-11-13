export const GUN_UPGRADES = Object.freeze({
    damage: {label: 'Schaden', increase: '+1 pro Kugel', baseCost: 30, costStep: 20},
    fireRate: {label: 'Feuerrate', increase: '+0,5 Schussserien/s', baseCost: 35, costStep: 25},
    bullets: {label: 'Kugeln', increase: '+1 pro Schussserie', baseCost: 55, costStep: 40, maxLevel: 4}
});

export function gunUpgradeCost(kind, level) {
    const upgrade = GUN_UPGRADES[kind];
    if (!upgrade || !Number.isSafeInteger(level) || level < 0 || (upgrade.maxLevel !== undefined && level >= upgrade.maxLevel)) {
        throw new Error('Ungültiges Waffenupgrade.');
    }
    return upgrade.baseCost + upgrade.costStep * level;
}

export function healingCost(hp, maximumHp) {
    if (!Number.isFinite(hp) || !Number.isFinite(maximumHp) || maximumHp < 1 || hp < 0 || hp > maximumHp) {
        throw new Error('Ungültige Lebenspunkte.');
    }
    return Math.ceil((maximumHp - hp) / 5);
}
