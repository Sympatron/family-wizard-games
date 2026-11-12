export function finishLinePosition(playerZ, speed, secondsRemaining) {
    if (!Number.isFinite(playerZ) || !(speed > 0) || !Number.isFinite(secondsRemaining)) throw new Error('Ungültige Zielposition.');
    return playerZ - speed * Math.max(0, secondsRemaining);
}

export function canSpawnBeforeGoal(spawnZ, goalZ, clearance = 4) {
    return Number.isFinite(spawnZ) && Number.isFinite(goalZ) && spawnZ >= goalZ + clearance;
}
