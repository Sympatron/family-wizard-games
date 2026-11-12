const PRESETS = [
    {aspect: 0.4, fov: 92, y: 18.5, z: 22.5},
    {aspect: 0.56, fov: 84, y: 16.6, z: 22.8},
    {aspect: 1, fov: 68, y: 10, z: 20},
    {aspect: 1.6, fov: 50, y: 7, z: 20.5},
    {aspect: 2.2, fov: 46, y: 5.5, z: 19}
];

export function runnerCameraSettings(width, height) {
    if (!(width > 0 && height > 0)) throw new Error('Ungültige Spielfeldgröße.');
    const aspect = width / height;
    let left = PRESETS[0], right = PRESETS.at(-1);
    for (let i = 1; i < PRESETS.length; i++) {
        if (aspect <= PRESETS[i].aspect) {
            left = PRESETS[i - 1];
            right = PRESETS[i];
            break;
        }
    }
    const factor = Math.max(0, Math.min(1, (aspect - left.aspect) / (right.aspect - left.aspect)));
    const lerp = key => left[key] + (right[key] - left[key]) * factor;
    return {fov: lerp('fov'), y: lerp('y'), z: lerp('z'), lookY: 1.5, lookZ: -28, far: 340, fogNear: 85, fogFar: 260};
}
