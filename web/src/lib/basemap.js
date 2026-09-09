// Public style configuration; no private API keys belong here.
export function prepareBasemap(key, mapidStyle) {
  const customStyle = import.meta.env.VITE_BASEMAP_STYLE_URL?.trim();
  if (customStyle) return { style: customStyle, configured: true };
  if (key) return { style: `https://v2.basemap.mapid.io/styles/${mapidStyle}/style.json?key=${encodeURIComponent(key)}`, configured: true };
  return { configured: false, style: { version: 8, sources: {}, layers: [{ id: 'latar', type: 'background', paint: { 'background-color': '#e8f0e9' } }] } };
}
