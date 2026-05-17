import { FeatureCollection, Feature, Geometry } from 'geojson';
import proj4 from 'proj4';
import { toast } from 'sonner';

// ============================================================================
// 1. KADASTRO & İMAR ALANLARI VE METRİK DÖNÜŞÜMLER
// ============================================================================

export interface CadastralMetadata {
  isCadastral: boolean;
  isZoning: boolean;
  provinceCode?: string;
  districtCode?: string;
  neighborhoodCode?: string;
  block?: string;       // ADA
  parcel?: string;      // PARSEL
  areaSqm?: number;     // m²
  areaDonum?: number;   // Dönüm (1000 m²)
  zoningFunction?: string; // FONKSIYON
  zoningEmsal?: string;    // EMSAL
  zoningHeight?: string;   // YUKSEKLIK
  zoningTaks?: string;     // TAKS
  zoningKaks?: string;     // KAKS
}

/**
 * Parsel ve İmar alanlarını otomatik tanır, etiketler ve m² -> Dönüm dönüşümü yapar
 */
export function analyzeCadastralFeature(properties: Record<string, any> | null): CadastralMetadata {
  if (!properties) return { isCadastral: false, isZoning: false };

  const keys = Object.keys(properties).map(k => k.toUpperCase());
  const getVal = (keyMatch: string | RegExp) => {
    const found = Object.keys(properties).find(k => k.toUpperCase().match(keyMatch));
    return found ? properties[found] : undefined;
  };

  const block = getVal(/^(ADA|ADANO|BLOCK)$/);
  const parcel = getVal(/^(PARSEL|PARSELNO|PARCEL)$/);
  const area = getVal(/^(ALAN|AREA|YUZOLCUM|SQM)$/);
  const zoningFunc = getVal(/^(FONKSIYON|FUNCTION|IMAR_DURUMU|LEJANT)$/);

  const isCad = Boolean(block || parcel || keys.includes('IL_KOD') || keys.includes('ILCE_KOD') || keys.includes('MAH_KOD'));
  const isZon = Boolean(zoningFunc || keys.includes('EMSAL') || keys.includes('YUKSEKLIK') || keys.includes('TAKS') || keys.includes('KAKS'));

  let areaSqm: number | undefined = typeof area === 'number' ? area : parseFloat(area);
  let areaDonum: number | undefined = undefined;

  if (areaSqm !== undefined && !isNaN(areaSqm)) {
    areaDonum = parseFloat((areaSqm / 1000).toFixed(3)); // 1 Dönüm = 1000 m²
  } else {
    areaSqm = undefined;
  }

  return {
    isCadastral: isCad,
    isZoning: isZon,
    provinceCode: getVal(/^IL_KOD$/),
    districtCode: getVal(/^ILCE_KOD$/),
    neighborhoodCode: getVal(/^(MAH_KOD|MAHALLE)$/),
    block: block ? String(block) : undefined,
    parcel: parcel ? String(parcel) : undefined,
    areaSqm,
    areaDonum,
    zoningFunction: zoningFunc ? String(zoningFunc) : undefined,
    zoningEmsal: getVal(/^EMSAL$/),
    zoningHeight: getVal(/^YUKSEKLIK$/),
    zoningTaks: getVal(/^TAKS$/),
    zoningKaks: getVal(/^KAKS$/),
  };
}

/**
 * İmar planı fonksiyonlarına göre otomatik renk kodlaması yapar (INSPIRE uyumlu)
 */
export function getZoningColor(zoningFunction?: string): string {
  if (!zoningFunction) return '#3b82f6'; // Varsayılan mavi

  const func = zoningFunction.toUpperCase();
  if (func.includes('KONUT') || func.includes('RESIDENTIAL')) return '#facc15'; // Konut = Sarı
  if (func.includes('TICARET') || func.includes('COMMERCIAL')) return '#ef4444'; // Ticaret = Kırmızı
  if (func.includes('SANAYI') || func.includes('INDUSTRIAL')) return '#a855f7'; // Sanayi = Mor
  if (func.includes('PARK') || func.includes('YESIL') || func.includes('GREEN')) return '#22c55e'; // Park/Yeşil = Yeşil
  if (func.includes('EGITIM') || func.includes('OKUL') || func.includes('EDUCATION')) return '#3b82f6'; // Eğitim = Mavi
  if (func.includes('SAGLIK') || func.includes('HASTANE') || func.includes('HEALTH')) return '#ec4899'; // Sağlık = Pembe
  if (func.includes('BELEDIYE') || func.includes('KAMU') || func.includes('PUBLIC')) return '#64748b'; // Kamu = Gri

  return '#3b82f6';
}

// ============================================================================
// 2. WMS/WFS SERVİS BAĞLANTISI VE GETCAPABILITIES PARSER
// ============================================================================

export interface OGCServiceLayer {
  title: string;
  name: string;
  abstract?: string;
  wmsUrl?: string;
  wfsUrl?: string;
}

export const DEFAULT_OGC_SERVICES = [
  { name: 'TKGM Parsel WMS', url: 'https://cbsservis.tkgm.gov.tr/megsisharita/' },
  { name: 'İlbank İmar WMS', url: 'https://cbs.ilbank.gov.tr/wms' },
];

/**
 * WMS/WFS GetCapabilities XML çıktısını ayrıştırarak katman listesini döndürür
 */
export async function parseGetCapabilities(serviceUrl: string): Promise<OGCServiceLayer[]> {
  try {
    const cleanUrl = serviceUrl.split('?')[0];
    const capUrl = `${cleanUrl}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities`;
    const res = await fetch(capUrl);
    if (!res.ok) throw new Error('GetCapabilities isteği başarısız');

    const xmlText = await res.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(xmlText, 'text/xml');

    const layerNodes = xml.querySelectorAll('Capability > Layer > Layer'); // Sub-layers
    const layers: OGCServiceLayer[] = [];

    layerNodes.forEach(node => {
      const name = node.querySelector('Name')?.textContent || '';
      const title = node.querySelector('Title')?.textContent || name;
      const abstract = node.querySelector('Abstract')?.textContent || '';

      if (name) {
        layers.push({
          title, 
          name, 
          abstract, 
          wmsUrl: `${cleanUrl}?layers=${name}&transparent=true&format=image/png&service=WMS&version=1.3.0&request=GetMap`,
          wfsUrl: `${cleanUrl}?service=WFS&version=2.0.0&request=GetFeature&typeName=${name}&outputFormat=application/json`
        });
      }
    });

    return layers;
  } catch (err: any) {
    toast.error(`Servis analizi başarısız: ${err.message}`);
    return [];
  }
}

// ============================================================================
// 3. KOORDİNAT SİSTEMİ DÖNÜŞÜM PANELİ (ANLIK & BATCH)
// ============================================================================

/**
 * Tekil bir koordinatı veya tüm FeatureCollection'ı belirtilen projeksiyondan WGS84'e dönüştürür
 */
export function convertCoordinatesCadastral(
  input: [number, number] | FeatureCollection, 
  fromEpsg: string, 
  toEpsg: string = 'EPSG:4326'
): [number, number] | FeatureCollection {
  if (fromEpsg === toEpsg || !proj4.defs(fromEpsg)) return input;

  const transform = proj4(fromEpsg, toEpsg);

  if (Array.isArray(input)) {
    const [x, y] = input;
    const [lng, lat] = transform.forward([x, y]);
    return [lng, lat];
  }

  // Batch dönüşüm: Tüm FeatureCollection
  const reprojectCoords = (coords: any[]): any => {
    if (typeof coords[0] === 'number') {
      const [x, y] = coords;
      const [lng, lat] = transform.forward([x, y]);
      return [lng, lat];
    }
    return coords.map(reprojectCoords);
  };

  const features: Feature[] = input.features.map(f => ({
    ...f,
    geometry: f.geometry ? {
      ...f.geometry,
      // @ts-expect-error - GeoJSON coordinates recursion
      coordinates: reprojectCoords(f.geometry.coordinates),
    } : f.geometry
  }));

  toast.success(`Tüm katman ${fromEpsg} -> ${toEpsg} sistemine dönüştürüldü.`);

  return {
    ...input,
    features,
  };
}
