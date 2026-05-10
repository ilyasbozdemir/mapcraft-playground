import { kml } from '@tmcw/togeojson';
import { FeatureCollection } from 'geojson';
import JSZip from 'jszip';

export const parseKML = async (file: File): Promise<FeatureCollection> => {
  const text = await file.text();
  const parser = new DOMParser();
  const xml = parser.parseFromString(text, 'text/xml');
  return kml(xml);
};

export const parseKMZ = async (file: File): Promise<FeatureCollection> => {
  const zip = await JSZip.loadAsync(file);
  const kmlFile = Object.values(zip.files).find((f) => f.name.endsWith('.kml'));
  
  if (!kmlFile) {
    throw new Error('No KML file found in KMZ');
  }

  const kmlText = await kmlFile.async('string');
  const parser = new DOMParser();
  const xml = parser.parseFromString(kmlText, 'text/xml');
  return kml(xml);
};
