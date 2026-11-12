export function finishLinePosition(playerZ, speed, secondsRemaining) {
    if (!Number.isFinite(playerZ) || !(speed > 0) || !Number.isFinite(secondsRemaining)) throw new Error('Ungültige Zielposition.');
    return playerZ - speed * Math.max(0, secondsRemaining);
}
