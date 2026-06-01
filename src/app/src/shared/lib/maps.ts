export function buildOpenStreetMapEmbedUrl(
  latitude: number,
  longitude: number,
  radiusKm: number,
) {
  const latDelta = Math.max(radiusKm / 111, 0.01);
  const lngDelta = Math.max(radiusKm / (111 * Math.cos((latitude * Math.PI) / 180)), 0.01);
  const left = longitude - lngDelta;
  const right = longitude + lngDelta;
  const top = latitude + latDelta;
  const bottom = latitude - latDelta;

  return `https://www.openstreetmap.org/export/embed.html?bbox=${left}%2C${bottom}%2C${right}%2C${top}&layer=mapnik&marker=${latitude}%2C${longitude}`;
}
