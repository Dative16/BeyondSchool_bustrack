// src/ui/mapStyle.ts — keep Google's normal map colours.
//
// The earlier style repainted every geometry white/grey, which hid buildings
// and made the map hard to read on the bike. We now only remove noisy POI
// labels; roads, buildings and land use their standard Google colours.
const style = [
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'off' }] },
];

export const MAP_STYLE_JSON = JSON.stringify(style);
