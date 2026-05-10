import { FeatureCollection, Geometry } from 'geojson';

export const getRandomColor = () => {
  const colors = [
    '#3b82f6', // blue-500
    '#ef4444', // red-500
    '#10b981', // emerald-500
    '#f59e0b', // amber-500
    '#8b5cf6', // violet-500
    '#ec4899', // pink-500
    '#06b6d4', // cyan-500
    '#84cc16', // lime-500
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

export const getGeometryType = (data: FeatureCollection): string => {
  const types = new Set<string>();
  data.features.forEach((f) => {
    if (f.geometry) {
      types.add(f.geometry.type);
    }
  });

  if (types.size === 0) return 'Unknown';
  if (types.size > 1) return 'Mixed';
  return Array.from(types)[0];
};

export const formatSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const calculateBounds = (data: FeatureCollection): [number, number, number, number] | null => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let hasCoords = false;

  const traverse = (coords: any) => {
    if (typeof coords[0] === 'number') {
      const [x, y] = coords;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      hasCoords = true;
    } else if (Array.isArray(coords)) {
      coords.forEach(traverse);
    }
  };

  data.features.forEach((f) => {
    if (f.geometry) {
      const geom = f.geometry as any;
      if (geom.coordinates) {
        traverse(geom.coordinates);
      } else if (geom.geometries) {
        geom.geometries.forEach((g: any) => traverse(g.coordinates));
      }
    }
  });

  if (!hasCoords) return null;
  return [minY, minX, maxY, maxX]; // Leaflet format: [south, west, north, east]
};
