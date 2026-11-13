export const COIN_VALUES = Object.freeze([1, 5, 10]);

export function makeCoinWave(random = Math.random) {
    return Array.from({length: 3}, (_, index) => {
        const roll = random();
        const value = roll < 0.6 ? 1 : roll < 0.9 ? 5 : 10;
        return {kind: 'coin', value, x: -4.8 + random() * 9.6, z: -72 - index * 3.2};
    });
}
export function crossedCoin(playerX, playerZ, previousZ, currentZ, coinX) {
    return previousZ <= playerZ && currentZ >= playerZ && Math.abs(playerX - coinX) <= 1.8;
}
