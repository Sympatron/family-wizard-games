import {SPECIES, MAX_TIER} from './species.js';

export const DNA_TYPES = Object.freeze({
    tank: {label: 'Tank-DNA', role: 'Tank'},
    damageDealer: {label: 'Damage-Dealer-DNA', role: 'Nahkampf'},
    sniper: {label: 'Sniper-DNA', role: 'Fernkampf'}
});
export const RUNNER_SKILLS = Object.freeze({
    damage: {label: 'Waffenschaden', effect: '+0,2 Schaden', maxLevel: 5, baseCost: 5, costStep: 5, requires: [], x: 50, y: 32},
    fireRate: {label: 'Feuerrate', effect: '+8 %', maxLevel: 5, baseCost: 8, costStep: 6, requires: ['damage'], x: 18, y: 24},
    bullets: {label: 'Kugeln', effect: '+1 Kugel', maxLevel: 4, baseCost: 14, costStep: 12, requires: ['damage'], x: 34, y: 12},
    magnet: {label: 'Magnet', effect: '+0,5 Reichweite', maxLevel: 5, baseCost: 7, costStep: 5, requires: ['damage'], x: 66, y: 12},
    spawn1: {label: 'Käfige · Rang 1', effect: 'Mehr Käfige', maxLevel: 5, baseCost: 7, costStep: 6, requires: ['damage'], x: 82, y: 24},
    spawn2: {label: 'Käfige · Rang 2', effect: 'Höhere Spawnchance', maxLevel: 5, baseCost: 15, costStep: 10, requires: ['spawn1'], x: 88, y: 44},
    spawn3: {label: 'Käfige · Rang 3', effect: 'Höhere Spawnchance', maxLevel: 5, baseCost: 35, costStep: 20, requires: ['spawn2'], x: 77, y: 66},
    spawn4: {label: 'Käfige · Rang 4', effect: 'Höhere Spawnchance', maxLevel: 5, baseCost: 70, costStep: 35, requires: ['spawn3'], minStage: 150, x: 58, y: 82}
});
export const ARENA_SKILLS = Object.freeze({
    damage: {label: 'Schaden', effect: '+6 %', maxLevel: 5, baseCost: 2, costStep: 2, requires: [], x: 50, y: 30},
    health: {label: 'Leben', effect: '+6 %', maxLevel: 5, baseCost: 3, costStep: 3, requires: ['damage'], x: 27, y: 25},
    speed: {label: 'Tempo', effect: '+4 %', maxLevel: 5, baseCost: 3, costStep: 3, requires: ['damage'], x: 73, y: 25},
    regeneration: {label: 'Regeneration', effect: '+5 % pro Runde', maxLevel: 5, baseCost: 5, costStep: 4, requires: ['health'], x: 18, y: 53},
    range: {label: 'Reichweite', effect: '+5 %', maxLevel: 5, baseCost: 4, costStep: 4, requires: ['speed'], x: 82, y: 53}
});
export const skillDefinitions = group => group === 'runner' ? RUNNER_SKILLS : Object.hasOwn(DNA_TYPES, group) ? ARENA_SKILLS : null;
export const dnaTypeForRole = role => Object.keys(DNA_TYPES).find(key => DNA_TYPES[key].role === role);
export const dnaTypeForDino = unit => dnaTypeForRole(SPECIES[unit.species]?.role);

export function dnaValue(unit) {
    const rank = SPECIES[unit?.species]?.rank;
    const tier = unit?.level;
    if (!Number.isInteger(rank) || rank < 1 || rank > 4 || !Number.isInteger(tier) || tier < 1 || tier > MAX_TIER) {
        throw new Error('Ungültiger Dinosaurier.');
    }
    return 2 ** ((rank - 1) * MAX_TIER + tier - 1);
}
export function getSkillLevel(meta, group, skill) {
    return meta?.skills?.[group]?.[skill] ?? 0;
}
export function skillCost(group, skill, level) {
    const definitions = skillDefinitions(group);
    const definition = definitions && Object.hasOwn(definitions, skill) ? definitions[skill] : null;
    if (!definition || !Number.isInteger(level) || level < 0 || level >= definition.maxLevel) throw new Error('Ungültiges Skill-Level.');
    return definition.baseCost + level * definition.costStep;
}
export function isSkillVisible(meta, group, skill) {
    const definitions = skillDefinitions(group);
    const definition = definitions && Object.hasOwn(definitions, skill) ? definitions[skill] : null;
    return !!definition && definition.requires.every(parent => getSkillLevel(meta, group, parent) >= definitions[parent].maxLevel);
}
export function getUnlockedRunnerRank(skills = {}) {
    return skills.spawn4 > 0 ? 4 : skills.spawn3 > 0 ? 3 : skills.spawn2 > 0 ? 2 : 1;
}
export function createSkillProgress() {
    return Object.fromEntries(['runner', ...Object.keys(DNA_TYPES)].map(group =>
        [group, Object.fromEntries(Object.keys(skillDefinitions(group)).map(key => [key, 0]))]));
}
export function normalizeSkillProgress(skills = {}) {
    const result = createSkillProgress();
    for (const group of Object.keys(result)) {
        for (const [key, definition] of Object.entries(skillDefinitions(group))) {
            const level = skills?.[group]?.[key] ?? 0;
            result[group][key] = Number.isSafeInteger(level) ? Math.max(0, Math.min(level, definition.maxLevel)) : 0;
        }
    }
    return result;
}
