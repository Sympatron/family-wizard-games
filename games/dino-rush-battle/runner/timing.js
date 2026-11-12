export function frameDeltaSeconds(previous, current, maxSeconds = 0.05) {
    if (!Number.isFinite(current) || !Number.isFinite(previous) || current < previous) return 0;
    return Math.max(0, Math.min(maxSeconds, (current - previous) / 1000));
}
