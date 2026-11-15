export const COIN_VALUES = Object.freeze([1, 5, 10]);
export const BASE_PICKUP_RANGE = 1.8;
export const MAX_PICKUP_RANGE = 4.5;

export function makeCoinWave(random = Math.random) {
    return Array.from({length: 3}, (_, index) => {
        const roll = random();
        const value = roll < 0.6 ? 1 : roll < 0.9 ? 5 : 10;
        return {kind: 'coin', value, x: -4.8 + random() * 9.6, z: -72 - index * 3.2};
    });
}
export function crossedCoin(playerX, playerZ, previousZ, currentZ, coinX, pickupRange = BASE_PICKUP_RANGE) {
    return previousZ <= playerZ && currentZ >= playerZ && Math.abs(playerX - coinX) <= pickupRange;
}
