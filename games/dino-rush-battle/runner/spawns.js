export const RUNNER_SPECIES = Object.freeze(['raptor', 'triceratops', 'pteranodon']);
export const TRACK_HALF_WIDTH = 6.5;

function randomBetween(min, max, random) {
    return min + (max - min) * random();
}

export function createRunnerWave(wave, stage, random = Math.random) {
    if (!Number.isInteger(wave) || wave < 0 || !Number.isInteger(stage) || stage < 1) throw new Error('Ungültige Welle.');
    const count = wave % 3 === 0 ? 3 : 2;
    return Array.from({length: count}, (_, index) => {
        const roll = random();
        const kind = wave === 0 && index === 0 ? 'cage' : roll < 0.6 ? 'cage' : roll < 0.82 ? 'barrier' : 'supply';
        return {
            kind,
            species: RUNNER_SPECIES[Math.min(RUNNER_SPECIES.length - 1, Math.floor(random() * RUNNER_SPECIES.length))],
            x: randomBetween(-TRACK_HALF_WIDTH + 1.4, TRACK_HALF_WIDTH - 1.4, random),
            z: -76 - index * 6 - randomBetween(0, 8, random)
        };
    });
}
