import * as shapefile from 'shapefile';
import { FeatureCollection, Feature, Geometry } from 'geojson';
import JSZip from 'jszip';
import proj4 from 'proj4';
import { toast } from 'sonner';

// Türkiye için yaygın EPSG projeksiyon tanımları
const TURKISH_PROJECTIONS: Record<string, string> = {
  'EPSG:5253': '+proj=tmerc +lat_0=0 +lon_0=27 +k=1 +x_0=500000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs', // TUREF TM27
  'EPSG:5254': '+proj=tmerc +lat_0=0 +lon_0=30 +k=1 +x_0=500000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs', // TUREF TM30
  'EPSG:5255': '+proj=tmerc +lat_0=0 +lon_0=33 +k=1 +x_0=500000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs', // TUREF TM33
  'EPSG:5256': '+proj=tmerc +lat_0=0 +lon_0=36 +k=1 +x_0=500000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs', // TUREF TM36
  'EPSG:5257': '+proj=tmerc +lat_0=0 +lon_0=39 +k=1 +x_0=500000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs', // TUREF TM39
  'EPSG:5258': '+proj=tmerc +lat_0=0 +lon_0=42 +k=1 +x_0=500000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs', // TUREF TM42
  'EPSG:5259': '+proj=tmerc +lat_0=0 +lon_0=45 +k=1 +x_0=500000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs', // TUREF TM45
  'EPSG:23035': '+proj=utm +zone=35 +ellps=intl +towgs84=-87,-98,-121,0,0,0,0 +units=m +no_defs', // ED50 UTM Zone 35N
  'EPSG:23036': '+proj=utm +zone=36 +ellps=intl +towgs84=-87,-98,-121,0,0,0,0 +units=m +no_defs', // ED50 UTM Zone 36N
  'EPSG:23037': '+proj=utm +zone=37 +ellps=intl +towgs84=-87,-98,-121,0,0,0,0 +units=m +no_defs', // ED50 UTM Zone 37N
  'EPSG:4326': '+proj=longlat +datum=WGS84 +no_defs',
};

// Proj4 tanımlarını kaydet
Object.entries(TURKISH_PROJECTIONS).forEach(([code, def]) => {
  if (!proj4.defs(code)) {
    proj4.defs(code, def);
  }
});

/**
 * PRJ dosyasından veya içerikten EPSG kodunu otomatik tespit eder
 */
export function detectProjectionFromPrj(prjContent: string): string {
  const upper = prjContent.toUpperCase();
  if (upper.includes('ITRF') || upper.includes('TUREF') || upper.includes('GRS 1980') || upper.includes('GRS80')) {
    if (upper.includes('CENTRAL_MERIDIAN",27')) return 'EPSG:5253';
    if (upper.includes('CENTRAL_MERIDIAN",30')) return 'EPSG:5254';
    if (upper.includes('CENTRAL_MERIDIAN",33')) return 'EPSG:5255';
    if (upper.includes('CENTRAL_MERIDIAN",36')) return 'EPSG:5256';
    if (upper.includes('CENTRAL_MERIDIAN",39')) return 'EPSG:5257';
    if (upper.includes('CENTRAL_MERIDIAN",42')) return 'EPSG:5258';
    if (upper.includes('CENTRAL_MERIDIAN",45')) return 'EPSG:5259';
    return 'EPSG:5255'; // Varsayılan TM33
  }
  if (upper.includes('ED_1950') || upper.includes('ED50')) {
    if (upper.includes('ZONE",35')) return 'EPSG:23035';
    if (upper.includes('ZONE",36')) return 'EPSG:23036';
    if (upper.includes('ZONE",37')) return 'EPSG:23037';
    return 'EPSG:23036'; // Varsayılan Zone 36
  }
  if (upper.includes('WGS_1984') || upper.includes('WGS 84')) {
    return 'EPSG:4326';
  }
  // Bilinmeyen projeksiyon durumunda toast ile uyar ve WGS84 kabul et veya kullanıcıya sor
  toast.warning('Bilinmeyen projeksiyon tanımı. WGS84 (EPSG:4326) varsayılarak işlem yapılıyor.');
  return 'EPSG:4326';
}

/**
 * Geometri koordinatlarını belirtilen projeksiyondan EPSG:4326 (WGS84) formatına dönüştürür
 */
export function reprojectGeometry(geometry: Geometry, fromEpsg: string): Geometry {
  if (fromEpsg === 'EPSG:4326' || !proj4.defs(fromEpsg)) return geometry;

  const transform = proj4(fromEpsg, 'EPSG:4326');

  const reprojectCoords = (coords: any[]): any => {
    if (typeof coords[0] === 'number') {
      const [x, y] = coords;
      const [lng, lat] = transform.forward([x, y]);
      return [lng, lat];
    }
    return coords.map(reprojectCoords);
  };

  return {
    ...geometry,
    // @ts-expect-error - GeoJSON coordinates structure recursion
    coordinates: reprojectCoords(geometry.coordinates),
  };
}

/**
 * DBF öznitelik isimlerini Netcad ve İmar standartlarına göre normalize eder
 */
export function normalizeAttributes(properties: Record<string, any> | null): Record<string, any> {
  if (!properties) return {};

  const normalized: Record<string, any> = {};
  
  // Türkçe karakter ve boşluk düzeltme haritası
  const charMap: Record<string, string> = { 'Ç': 'C', 'Ğ': 'G', 'İ': 'I', 'Ö': 'O', 'Ş': 'S', 'Ü': 'U', 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u' };
  
  Object.entries(properties).forEach(([key, value]) => {
    let cleanKey = key.trim().toUpperCase();
    // Türkçe harfleri normalize et
    cleanKey = cleanKey.replace(/[ÇĞİÖŞÜçğıöşü]/g, match => charMap[match] || match);
    // Boşlukları ve özel karakterleri alt çizgi yap veya birleştir
    cleanKey = cleanKey.replace(/\s+/g, '');

    // Netcad özel alan eşleştirmeleri
    if (cleanKey === 'KATNO' || cleanKey === 'KAT_NO') cleanKey = 'KATNO';
    if (cleanKey === 'ADANO' || cleanKey === 'ADA_NO') cleanKey = 'ADANO';
    if (cleanKey === 'PARSELNO' || cleanKey === 'PARSEL_NO') cleanKey = 'PARSELNO';
    if (cleanKey === 'MAHALLE' || cleanKey === 'MAH') cleanKey = 'MAHALLE';

    normalized[cleanKey] = value;
  });

  return normalized;
}

/**
 * DBF buffer'ını Türkçe CP1254 (ISO-8859-9) encoding ile okuyarak string değerleri düzeltir
 */
export function decodeTurkishDbfValues(properties: Record<string, any> | null): Record<string, any> {
  if (!properties) return {};
  const decoded: Record<string, any> = {};
  
  Object.entries(properties).forEach(([key, val]) => {
    if (typeof val === 'string') {
      // Gelen ham stringi CP1254/ISO-8859-9 tablosuna göre düzelt
      try {
        // Eğer tarayıcıda TextDecoder ISO-8859-9 destekliyorsa
        const decoder = new TextDecoder('iso-8859-9');
        const uintArray = new Uint8Array([...val].map(c => c.charCodeAt(0)));
        decoded[key] = decoder.decode(uintArray);
      } catch {
        decoded[key] = val;
      }
    } else {
      decoded[key] = val;
    }
  });

  return decoded;
}

/**
 * Shapefile, DBF ve PRJ dosyalarını Web Worker (veya Worker benzeri asenkron akış) ile işler.
 * Netcad (.ncz) veya normal .shp/.dbf/.prj dosyalarını destekler.
 */
export async function importShapefileAdvanced(
  files: File[],
  onProgress?: (progress: number, statusText: string) => void
): Promise<FeatureCollection> {
  onProgress?.(10, 'Dosyalar analiz ediliyor...');

  let shpBuffer: ArrayBuffer | undefined;
  let dbfBuffer: ArrayBuffer | undefined;
  let prjContent: string = '';
  let epsgCode: string = 'EPSG:4326';

  // Netcad NCZ / ZIP kontrolü
  const zipFile = files.find(f => f.name.toLowerCase().endsWith('.ncz') || f.name.toLowerCase().endsWith('.zip'));

  if (zipFile) {
    onProgress?.(20, 'Netcad/ZIP arşivi açılıyor...');
    const zip = await JSZip.loadAsync(zipFile);
    
    for (const [relativePath, fileEntry] of Object.entries(zip.files)) {
      const lower = relativePath.toLowerCase();
      if (lower.endsWith('.shp')) shpBuffer = await fileEntry.async('arraybuffer');
      if (lower.endsWith('.dbf')) dbfBuffer = await fileEntry.async('arraybuffer');
      if (lower.endsWith('.prj')) prjContent = await fileEntry.async('string');
    }
  } else {
    const shpFile = files.find(f => f.name.toLowerCase().endsWith('.shp'));
    const dbfFile = files.find(f => f.name.toLowerCase().endsWith('.dbf'));
    const prjFile = files.find(f => f.name.toLowerCase().endsWith('.prj'));

    if (shpFile) shpBuffer = await shpFile.arrayBuffer();
    if (dbfFile) dbfBuffer = await dbfFile.arrayBuffer();
    if (prjFile) prjContent = await prjFile.text();
  }

  if (!shpBuffer) {
    throw new Error('Shapefile (.shp) dosyası bulunamadı!');
  }

  if (prjContent) {
    epsgCode = detectProjectionFromPrj(prjContent);
    onProgress?.(30, `Projeksiyon tespit edildi: ${epsgCode}`);
  } else {
    toast.info('PRJ dosyası bulunamadı, coğrafi WGS84 (EPSG:4326) varsayılıyor.');
  }

  onProgress?.(40, 'Coğrafi veriler akıştan okunuyor...');

  // shapefile.open ile streaming / chunk bazlı okuma
  const source = await shapefile.open(shpBuffer, dbfBuffer);
  const features: Feature[] = [];
  let processedCount = 0;

  while (true) {
    const result = await source.read();
    if (result.done) break;

    const feature = result.value as Feature;
    
    // Nitelikleri CP1254 ile kodla ve normalize et
    const decodedProps = decodeTurkishDbfValues(feature.properties);
    const normalizedProps = normalizeAttributes(decodedProps);

    // Geometriyi WGS84'e dönüştür
    const reprojectedGeom = feature.geometry ? reprojectGeometry(feature.geometry, epsgCode) : feature.geometry;

    features.push({
      ...feature,
      properties: normalizedProps,
      geometry: reprojectedGeom,
    });

    processedCount++;
    if (processedCount % 500 === 0) {
      onProgress?.(Math.min(90, 40 + Math.floor(processedCount / 100)), `${processedCount} obje işlendi...`);
      // UI donmasını önlemek için main thread'e nefes aldır (Web Worker simülasyonu / asenkron yield)
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  onProgress?.(100, `İşlem tamamlandı! Toplam ${features.length} obje yüklendi.`);

  return {
    type: 'FeatureCollection',
    features,
  };
}
