import { FeatureCollection } from 'geojson';

export const parseGeoJSON = async (file: File): Promise<FeatureCollection> => {
  const text = await file.text();
  const data = JSON.parse(text);
  
  if (data.type === 'FeatureCollection') {
    return data;
  }
  
  if (data.type === 'Feature') {
    return {
      type: 'FeatureCollection',
      features: [data],
    };
  }

  if (data.type === 'GeometryCollection' || 
      ['Point', 'MultiPoint', 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon'].includes(data.type)) {
    return {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: data,
        properties: {}
      }],
    };
  }

  throw new Error('Invalid GeoJSON format');
};
