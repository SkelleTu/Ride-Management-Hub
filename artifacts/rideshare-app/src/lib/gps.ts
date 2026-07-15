export function getGpsLinks(lat: number, lng: number) {
  return {
    googleMaps: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    waze: `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`,
    appleMaps: `maps://maps.apple.com/?daddr=${lat},${lng}`,
    browser: `https://maps.google.com/?q=${lat},${lng}`
  };
}

export function openGpsApp(app: 'googleMaps' | 'waze' | 'appleMaps' | 'browser', lat: number, lng: number) {
  const links = getGpsLinks(lat, lng);
  window.open(links[app], '_blank');
}
