export const CAGE_HALF_WIDTH = 1.56;
export const CAGE_HALF_DEPTH = 1.52;

export function bulletHitsCage(bulletX, fromZ, toZ, cageX, cageZ) {
    const bulletRadius = 0.14;
    return Math.abs(bulletX - cageX) <= CAGE_HALF_WIDTH + bulletRadius &&
        Math.min(fromZ, toZ) <= cageZ + CAGE_HALF_DEPTH + bulletRadius &&
        Math.max(fromZ, toZ) >= cageZ - CAGE_HALF_DEPTH - bulletRadius;
}
