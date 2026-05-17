import { FeatureCollection } from 'geojson';
import { toast } from 'sonner';

export type OGCServiceType = 'WMS' | 'WMTS' | 'WFS' | 'TMS';

export interface OGCServiceEndpoint {
  serverUrl: string;
  serviceType: OGCServiceType;
  capabilitiesUrl: string;
  defaultParams: Record<string, string>;
}

/**
 * Bir Netcad veya genel harita sunucu adresinden OGC servis uç noktalarını (endpoint) oluşturur
 */
export function getOGCEndpoints(baseUrl: string): Record<OGCServiceType, OGCServiceEndpoint> {
  const cleanUrl = baseUrl.replace(/\/$/, '');

  // Eğer URL zaten netcadmapserver içeriyorsa doğrudan kullan, yoksa ekle
  const isNetcad = cleanUrl.toLowerCase().includes('netcadmapserver');
  const baseNetcad = isNetcad ? cleanUrl : `${cleanUrl}/netcadmapserver`;

  return {
    WMS: {
      serverUrl: `${baseNetcad}/wms`,
      serviceType: 'WMS',
      capabilitiesUrl: `${baseNetcad}/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities`,
      defaultParams: {
        SERVICE: 'WMS',
        VERSION: '1.3.0',
        REQUEST: 'GetMap',
        FORMAT: 'image/png',
        TRANSPARENT: 'true',
        CRS: 'EPSG:4326', // veya 3857
      }
    },
    WMTS: {
      serverUrl: `${baseNetcad}/wmts`,
      serviceType: 'WMTS',
      capabilitiesUrl: `${baseNetcad}/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetCapabilities`,
      defaultParams: {
        SERVICE: 'WMTS',
        VERSION: '1.0.0',
        REQUEST: 'GetTile',
        FORMAT: 'image/png',
        TILEMATRIXSET: 'GoogleMapsCompatible', // veya EPSG:3857
      }
    },
    WFS: {
      serverUrl: `${baseNetcad}/wfs`,
      serviceType: 'WFS',
      capabilitiesUrl: `${baseNetcad}/wfs?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetCapabilities`,
      defaultParams: {
        SERVICE: 'WFS',
        VERSION: '2.0.0',
        REQUEST: 'GetFeature',
        OUTPUTFORMAT: 'application/json',
      }
    },
    TMS: {
      // TMS genelde /tms/1.0.0/layername/{z}/{x}/{y}.png yapısındadır
      serverUrl: `${cleanUrl}/tms/1.0.0`,
      serviceType: 'TMS',
      capabilitiesUrl: `${cleanUrl}/tms/1.0.0`,
      defaultParams: {}
    }
  };
}

/**
 * WFS servisine GetFeature isteği atarak vektör veriyi GeoJSON FeatureCollection olarak indirir
 */
export async function fetchWFSGeoJSON(wfsEndpointUrl: string, typeName: string): Promise<FeatureCollection> {
  try {
    toast.loading(`WFS vektör katmanı yükleniyor: ${typeName}`);
    
    const urlObj = new URL(wfsEndpointUrl);
    urlObj.searchParams.set('SERVICE', 'WFS');
    urlObj.searchParams.set('VERSION', '2.0.0');
    urlObj.searchParams.set('REQUEST', 'GetFeature');
    urlObj.searchParams.set('TYPENAME', typeName);
    urlObj.searchParams.set('OUTPUTFORMAT', 'application/json');

    const res = await fetch(urlObj.toString());
    if (!res.ok) throw new Error(`WFS isteği başarısız: ${res.statusText}`);

    const data = await res.json();
    toast.dismiss();
    toast.success(`WFS katmanı başarıyla yüklendi: ${typeName}`);
    return data as FeatureCollection;
  } catch (err: any) {
    toast.dismiss();
    toast.error(`WFS bağlantı hatası: ${err.message}`);
    throw err;
  }
}

/**
 * WMS katmanı için Leaflet TileLayer URL şablonunu oluşturur
 */
export function buildWMSTileLayerUrl(wmsEndpointUrl: string, layers: string): string {
  const urlObj = new URL(wmsEndpointUrl);
  urlObj.searchParams.set('SERVICE', 'WMS');
  urlObj.searchParams.set('VERSION', '1.3.0');
  urlObj.searchParams.set('REQUEST', 'GetMap');
  urlObj.searchParams.set('LAYERS', layers);
  urlObj.searchParams.set('FORMAT', 'image/png');
  urlObj.searchParams.set('TRANSPARENT', 'true');
  urlObj.searchParams.set('WIDTH', '256');
  urlObj.searchParams.set('HEIGHT', '256');
  // Leaflet TileLayer {bbox} parametresini otomatik doldurur
  urlObj.searchParams.set('BBOX', '{bbox}');

  return urlObj.toString();
}

/**
 * WMTS katmanı için Leaflet TileLayer URL şablonunu oluşturur
 */
export function buildWMTSTileLayerUrl(wmtsEndpointUrl: string, layer: string, tileMatrixSet: string = 'EPSG:3857'): string {
  const urlObj = new URL(wmtsEndpointUrl);
  urlObj.searchParams.set('SERVICE', 'WMTS');
  urlObj.searchParams.set('VERSION', '1.0.0');
  urlObj.searchParams.set('REQUEST', 'GetTile');
  urlObj.searchParams.set('LAYER', layer);
  urlObj.searchParams.set('STYLE', 'default');
  urlObj.searchParams.set('FORMAT', 'image/png');
  urlObj.searchParams.set('TILEMATRIXSET', tileMatrixSet);
  urlObj.searchParams.set('TILEMATRIX', '{z}');
  urlObj.searchParams.set('TILEROW', '{y}');
  urlObj.searchParams.set('TILECOL', '{x}');

  return urlObj.toString();
}
