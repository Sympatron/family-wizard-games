export const RUNNER_SPECIES = Object.freeze(['raptor', 'triceratops', 'pteranodon']);
export const ADVANCED_SPECIES = Object.freeze(['allosaurus', 'troodon', 'ankylosaurus', 'stegosaurus', 'quetzalcoatlus', 'tapejara']);
export const TRACK_HALF_WIDTH = 6.5;

export function cageHitPoints(stage, rarity) {
    if (!Number.isInteger(stage) || stage < 1) throw new Error('Ungültige Stufe.');
    const base = 5 + Math.ceil(stage * 0.65);
    if (rarity === 'common') return base;
    if (rarity === 'reinforced') return Math.ceil(base * 2.2);
    if (rarity === 'rare') return Math.ceil(base * 3.5);
    throw new Error('Ungültiger Käfig.');
}
export function createRunnerWave(wave, stage, random = Math.random) {
    if (!Number.isInteger(wave) || wave < 0 || !Number.isInteger(stage) || stage < 1) throw new Error('Ungültige Welle.');
    const count = stage >= 4 && wave > 0 && wave % 4 === 0 ? 2 : 1;
    return Array.from({length: count}, (_, index) => {
        const chance = random();
        const rareChance = stage >= 8 ? Math.min(0.14, 0.07 + (stage - 8) * 0.01) : 0;
        const reinforcedChance = stage >= 3 ? Math.min(0.38, 0.18 + (stage - 3) * 0.025) : 0;
        const rarity = chance < rareChance ? 'rare' : chance < rareChance + reinforcedChance ? 'reinforced' : 'common';
        const types = rarity === 'rare' ? ADVANCED_SPECIES : RUNNER_SPECIES;
        const species = types[Math.min(types.length - 1, Math.floor(random() * types.length))];
        return {
            kind: 'cage', rarity, species, level: rarity === 'reinforced' ? 2 : 1,
            hp: cageHitPoints(stage, rarity),
            x: -4.9 + random() * 9.8,
            z: -72 - index * 6 - random() * 8
        };
    });
}
