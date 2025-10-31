// Reverse geocoding utility using Nominatim
export async function reverseGeocode(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&accept-language=en`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to reverse geocode');
  const data = await response.json();
  return data.address?.suburb || data.address?.village || data.address?.town || data.address?.city || data.address?.county || data.address?.state || data.display_name || `${lat}, ${lon}`;
}
