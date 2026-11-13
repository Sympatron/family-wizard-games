export function battlefieldCover(imageWidth, imageHeight, viewportWidth, viewportHeight) {
    if (![imageWidth, imageHeight, viewportWidth, viewportHeight].every(value => Number.isFinite(value) && value > 0)) {
        throw new Error('Ungültige Spielfeldabmessungen.');
    }
    const scale = Math.max(viewportWidth / imageWidth, viewportHeight / imageHeight);
    return {scale, width: imageWidth * scale, height: imageHeight * scale};
}
