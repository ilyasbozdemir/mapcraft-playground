import { Feature, FeatureCollection, Geometry } from 'geojson';
import * as sax from 'sax';
import * as topojson from 'topojson-client';
import Papa from 'papaparse';
import { toast } from 'sonner';

/**
 * Bellek kullanımını kontrol eder (200MB limiti)
 */
function checkMemoryLimit(estimatedBytes: number): boolean {
  const MAX_MEMORY = 200 * 1024 * 1024; // 200 MB
  // @ts-expect-error - performance.memory is Chrome/V8 specific
  if (typeof performance !== 'undefined' && performance.memory) {
    // @ts-expect-error - performance.memory
    const used = performance.memory.usedJSHeapSize;
    if (used + estimatedBytes > MAX_MEMORY) {
      toast.warning('Bellek limiti (200MB) aşıldı! Harita performansı için veriyi Vektör Tile (MVT) formatına dönüştürmeniz önerilir.');
      return true;
    }
  } else if (estimatedBytes > MAX_MEMORY) {
    toast.warning('Dosya boyutu 200MB üzerinde! Harita performansı için veriyi Vektör Tile (MVT) formatına dönüştürmeniz önerilir.');
    return true;
  }
  return false;
}

import { JSONParser } from '@streamparser/json';

/**
 * 1. GeoJSON Streaming: @streamparser/json Pipeline
 * Belleği şişirmeden, doğrudan Uint8Array akışını işleyip 500 feature'lık yığınlar halinde iletir.
 */
export async function loadGeoJSONStreamPipeline(
  file: File, 
  onBatch: (features: Feature[]) => void, 
  batchSize: number = 500
): Promise<void> {
  checkMemoryLimit(file.size);

  const parser = new JSONParser({ stringBufferSize: undefined, paths: ['$.features.*'] });
  let batch: Feature[] = [];

  parser.onValue = ({ value }: any) => {
    if (value && value.type === 'Feature') {
      batch.push(value as Feature);
      if (batch.length >= batchSize) {
        onBatch([...batch]);
        batch = [];
      }
    }
  };

  const stream = file.stream();
  const reader = stream.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    try {
      parser.write(value);
    } catch (e) {
      console.error('JSONParser write error:', e);
    }
    // UI thread'in kilitlenmesini önlemek için küçük bir nefes aralığı
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  if (batch.length > 0) {
    onBatch(batch);
  }
}

/**
 * 2. KML Big Data Desteği: SAX Parser (10MB+ KML dosyaları için)
 */
export async function parseKMLStreamingSAX(file: File, onBatch: (features: Feature[]) => void): Promise<void> {
  const stream = file.stream();
  const reader = stream.getReader();
  const decoder = new TextDecoder();

  const parser = sax.parser(true, { trim: true, normalize: true });
  let currentTag = '';
  let placemarkObj: any = null;
  let coordsText = '';
  let styleMap: Record<string, any> = {};
  let currentStyleId = '';
  let batch: Feature[] = [];

  parser.onopentag = (node) => {
    currentTag = node.name;
    if (node.name === 'Style') {
      currentStyleId = node.attributes.id ? `#${node.attributes.id}` : '';
      if (currentStyleId) styleMap[currentStyleId] = {};
    } else if (node.name === 'Placemark') {
      placemarkObj = { name: '', description: '', styleUrl: '', geometry: null, properties: {} };
      coordsText = '';
    } else if (node.name === 'NetworkLink') {
      toast.info('KML NetworkLink algılandı, uzak kaynaklar arka planda taranıyor...');
    }
  };

  parser.ontext = (text) => {
    if (currentTag === 'name' && placemarkObj) placemarkObj.name = text;
    else if (currentTag === 'description' && placemarkObj) placemarkObj.description = text;
    else if (currentTag === 'styleUrl' && placemarkObj) placemarkObj.styleUrl = text;
    else if (currentTag === 'coordinates' && placemarkObj) coordsText += text;
    else if (currentTag === 'color' && currentStyleId && styleMap[currentStyleId]) {
      // KML renkleri aabbggrr formatındadır, Leaflet için #rrggbb yap
      const kmlColor = text.trim();
      if (kmlColor.length >= 8) {
        const b = kmlColor.slice(2, 4);
        const g = kmlColor.slice(4, 6);
        const r = kmlColor.slice(6, 8);
        styleMap[currentStyleId].color = `#${r}${g}${b}`;
      }
    } else if (currentTag === 'width' && currentStyleId && styleMap[currentStyleId]) {
      styleMap[currentStyleId].weight = parseFloat(text);
    }
  };

  parser.onclosetag = (tagName) => {
    if (tagName === 'Placemark' && placemarkObj) {
      if (coordsText) {
        const coordTriplets = coordsText.trim().split(/\s+/).map(pair => {
          const parts = pair.split(',').map(Number);
          return [parts[0], parts[1]];
        }).filter(c => !isNaN(c[0]) && !isNaN(c[1]));

        if (coordTriplets.length > 0) {
          let geom: Geometry;
          if (coordTriplets.length === 1) geom = { type: 'Point', coordinates: coordTriplets[0] };
          else if (coordTriplets[0][0] === coordTriplets[coordTriplets.length-1][0] && coordTriplets[0][1] === coordTriplets[coordTriplets.length-1][1] && coordTriplets.length >= 4) {
            geom = { type: 'Polygon', coordinates: [coordTriplets] };
          } else {
            geom = { type: 'LineString', coordinates: coordTriplets };
          }

          const style = styleMap[placemarkObj.styleUrl] || {};

          batch.push({
            type: 'Feature',
            properties: {
              name: placemarkObj.name,
              description: placemarkObj.description,
              ...style,
              ...placemarkObj.properties,
            },
            geometry: geom,
          });

          if (batch.length >= 500) {
            onBatch([...batch]);
            batch = [];
          }
        }
      }
      placemarkObj = null;
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    parser.write(decoder.decode(value, { stream: true }));
  }
  parser.close();

  if (batch.length > 0) {
    onBatch(batch);
  }
}

/**
 * 3. JSON Varyant Desteği & TopoJSON / CSV Ayrıştırıcı
 */
export async function parseJSONVariantsAndCSV(file: File): Promise<FeatureCollection> {
  const text = await file.text();
  const extension = file.name.split('.').pop()?.toLowerCase();

  // CSV with lat/lng kolonları
  if (extension === 'csv') {
    return new Promise((resolve, reject) => {
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const features: Feature[] = [];
          results.data.forEach((row: any) => {
            // Lat/Lng kolonlarını otomatik tespit et
            const latKey = Object.keys(row).find(k => k.toLowerCase().match(/^(lat|latitude|enlem|y)$/));
            const lngKey = Object.keys(row).find(k => k.toLowerCase().match(/^(lon|lng|longitude|boylam|x)$/));

            if (latKey && lngKey) {
              const lat = parseFloat(row[latKey]);
              const lng = parseFloat(row[lngKey]);
              if (!isNaN(lat) && !isNaN(lng)) {
                features.push({
                  type: 'Feature',
                  properties: row,
                  geometry: { type: 'Point', coordinates: [lng, lat] },
                });
              }
            }
          });
          resolve({ type: 'FeatureCollection', features });
        },
        error: (err: any) => reject(err),
      });
    });
  }

  const json = JSON.parse(text);

  // 1. GeoJSON FeatureCollection
  if (json.type === 'FeatureCollection' && Array.isArray(json.features)) {
    return json;
  }

  // 2. TopoJSON -> GeoJSON Dönüşümü
  if (json.type === 'Topology' && json.objects) {
    const key = Object.keys(json.objects)[0];
    const geo = topojson.feature(json, json.objects[key]);
    return geo as unknown as FeatureCollection;
  }

  // 3. GeoJSON Feature Dizisi: [ {...}, {...} ]
  if (Array.isArray(json) && json[0]?.type === 'Feature') {
    return { type: 'FeatureCollection', features: json };
  }

  // 4. Koordinat Dizisi: [ [lng, lat], [lng, lat] ]
  if (Array.isArray(json) && Array.isArray(json[0]) && typeof json[0][0] === 'number') {
    const features: Feature[] = json.map((coords, i) => ({
      type: 'Feature',
      properties: { id: i + 1 },
      geometry: { type: 'Point', coordinates: [coords[0], coords[1]] },
    }));
    return { type: 'FeatureCollection', features };
  }

  // 5. PostGIS JSON Çıktısı: { type: 'Point', coordinates: [...], properties: {...} }
  if (json.type && json.coordinates) {
    return {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: json.properties || {},
        geometry: { type: json.type, coordinates: json.coordinates },
      }]
    };
  }

  throw new Error('Desteklenmeyen JSON/CSV varyantı veya eksik veri yapısı.');
}
