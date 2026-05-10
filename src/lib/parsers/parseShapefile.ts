import * as shapefile from 'shapefile';
import { FeatureCollection } from 'geojson';
import JSZip from 'jszip';

export const parseShapefileZip = async (file: File): Promise<FeatureCollection> => {
  const zip = await JSZip.loadAsync(file);
  const shpFile = Object.values(zip.files).find((f) => f.name.endsWith('.shp'));
  const dbfFile = Object.values(zip.files).find((f) => f.name.endsWith('.dbf'));

  if (!shpFile) {
    throw new Error('No .shp file found in ZIP');
  }

  const shpBuffer = await shpFile.async('arraybuffer');
  const dbfBuffer = dbfFile ? await dbfFile.async('arraybuffer') : undefined;

  const result = await shapefile.read(shpBuffer, dbfBuffer);
  return result;
};

export const parseShapefileFiles = async (files: File[]): Promise<FeatureCollection> => {
  const shpFile = files.find((f) => f.name.endsWith('.shp'));
  const dbfFile = files.find((f) => f.name.endsWith('.dbf'));

  if (!shpFile) {
    throw new Error('No .shp file found');
  }

  const shpBuffer = await shpFile.arrayBuffer();
  const dbfBuffer = dbfFile ? await dbfFile.arrayBuffer() : undefined;

  const result = await shapefile.read(shpBuffer, dbfBuffer);
  return result;
};
