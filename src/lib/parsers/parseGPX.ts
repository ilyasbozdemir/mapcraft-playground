import { gpx } from '@tmcw/togeojson';
import { FeatureCollection } from 'geojson';

export const parseGPX = async (file: File): Promise<FeatureCollection> => {
  const text = await file.text();
  const parser = new DOMParser();
  const xml = parser.parseFromString(text, 'text/xml');
  return gpx(xml);
};
