import L from 'leaflet';
import * as turf from '@turf/turf';
import { Feature, FeatureCollection, Geometry } from 'geojson';
import { openDB } from 'idb';
import 'leaflet.markercluster';

// ============================================================================
// 1. INDEXEDDB TILE CACHE & OFFLINE MOD (50MB LRU LIMIT)
// ============================================================================

const CACHE_DB_NAME = 'MapcraftTileCacheDB';
const TILE_STORE_NAME = 'tiles';
const MAX_CACHE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

async function getTileDB() {
  return openDB(CACHE_DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(TILE_STORE_NAME)) {
        const store = db.createObjectStore(TILE_STORE_NAME, { keyPath: 'url' });
        store.createIndex('timestamp', 'timestamp');
      }
    },
  });
}

/**
 * LRU (Least Recently Used) algoritması ile 50MB limitini korur
 */
async function enforceCacheLimit() {
  const db = await getTileDB();
  let totalSize = 0;
  const tx = db.transaction(TILE_STORE_NAME, 'readwrite');
  const store = tx.objectStore(TILE_STORE_NAME);
  const allKeys = await store.getAllKeys();
  const allTiles = await store.getAll();

  allTiles.forEach(tile => { totalSize += tile.blob.size; });

  if (totalSize > MAX_CACHE_SIZE_BYTES) {
    // Eskiden yeniye sırala
    allTiles.sort((a, b) => a.timestamp - b.timestamp);
    for (const tile of allTiles) {
      if (totalSize <= MAX_CACHE_SIZE_BYTES) break;
      await store.delete(tile.url);
      totalSize -= tile.blob.size;
    }
  }
}

/**
 * Tile'ı cache'den getirir, yoksa fetch edip IndexedDB'ye yazar
 */
export async function fetchCachedTile(url: string): Promise<string> {
  const db = await getTileDB();
  const cached = await db.get(TILE_STORE_NAME, url);

  if (cached) {
    // LRU timestamp güncelle
    cached.timestamp = Date.now();
    await db.put(TILE_STORE_NAME, cached);
    return URL.createObjectURL(cached.blob);
  }

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Network res not ok');
    const blob = await res.blob();
    await db.put(TILE_STORE_NAME, { url, blob, timestamp: Date.now() });
    enforceCacheLimit();
    return URL.createObjectURL(blob);
  } catch {
    return url; // Fallback
  }
}

// ============================================================================
// 2. LEVEL OF DETAIL (LOD) & VIEWPORT CULLING & VIRTUALIZATION
// ============================================================================

interface LODConfig {
  maxFeatures: number;
  simplifyTolerance: number;
}

function getLODConfig(zoom: number): LODConfig {
  if (zoom < 8) return { maxFeatures: 500, simplifyTolerance: 0.01 };
  if (zoom >= 8 && zoom < 12) return { maxFeatures: 2000, simplifyTolerance: 0.001 };
  if (zoom >= 12 && zoom < 15) return { maxFeatures: 10000, simplifyTolerance: 0.0001 };
  return { maxFeatures: Infinity, simplifyTolerance: 0 }; // zoom >= 15
}

/**
 * Feature'ın Leaflet bounds içinde olup olmadığını kontrol eder
 */
function isFeatureInBounds(feature: Feature, bounds: L.LatLngBounds): boolean {
  if (!feature.geometry) return false;
  try {
    const [minX, minY, maxX, maxY] = turf.bbox(feature);
    const featureBounds = L.latLngBounds([minY, minX], [maxY, maxX]);
    return bounds.intersects(featureBounds);
  } catch {
    return true; // Fallback
  }
}

/**
 * L.LayerGroup tabanlı, Viewport Culling, LOD ve requestAnimationFrame destekli Sanal Katman
 */
export class VirtualLayerGroup extends L.LayerGroup {
  private geojsonCollection: FeatureCollection;
  private mapInstance: L.Map | null = null;
  private debounceTimeout: NodeJS.Timeout | null = null;
  private isLayerVisible: boolean = true;
  private styleCallback?: (feature: Feature) => L.PathOptions;
  private onEachFeatureCallback?: (feature: Feature, layer: L.Layer) => void;
  private markerClusterGroup?: L.MarkerClusterGroup;

  constructor(
    geojson: FeatureCollection, 
    options?: { 
      style?: (feature: Feature) => L.PathOptions; 
      onEachFeature?: (feature: Feature, layer: L.Layer) => void;
    }
  ) {
    super();
    this.geojsonCollection = geojson;
    this.styleCallback = options?.style;
    this.onEachFeatureCallback = options?.onEachFeature;

    // Eğer büyük bir nokta kümesi varsa MarkerClusterGroup oluştur
    const pointsCount = geojson.features.filter(f => f.geometry?.type === 'Point').length;
    if (pointsCount > 5000) {
      this.markerClusterGroup = L.markerClusterGroup({
        disableClusteringAtZoom: 13,
        chunkedLoading: true,
      });
      super.addLayer(this.markerClusterGroup!);
    }
  }

  onAdd(map: L.Map): this {
    super.onAdd(map);
    this.mapInstance = map;
    this.isLayerVisible = true;
    this.scheduleUpdate();

    map.on('moveend', this.onMapMove, this);
    map.on('zoomend', this.onMapMove, this);
    return this;
  }

  onRemove(map: L.Map): this {
    map.off('moveend', this.onMapMove, this);
    map.off('zoomend', this.onMapMove, this);
    if (this.debounceTimeout) clearTimeout(this.debounceTimeout);
    this.mapInstance = null;
    this.isLayerVisible = false;
    super.onRemove(map);
    return this;
  }

  public setVisibility(visible: boolean) {
    this.isLayerVisible = visible;
    if (visible && this.mapInstance) {
      this.scheduleUpdate();
    } else {
      this.clearLayersCustom();
    }
  }

  private clearLayersCustom() {
    if (this.markerClusterGroup) {
      this.markerClusterGroup.clearLayers();
    } else {
      this.clearLayers();
    }
  }

  private onMapMove() {
    if (!this.isLayerVisible || !this.mapInstance) return;
    if (this.debounceTimeout) clearTimeout(this.debounceTimeout);

    // 150ms debounce throttle
    this.debounceTimeout = setTimeout(() => {
      this.scheduleUpdate();
    }, 150);
  }

  private scheduleUpdate() {
    if (!this.mapInstance || !this.isLayerVisible) return;

    const bounds = this.mapInstance.getBounds();
    const zoom = this.mapInstance.getZoom();
    const lod = getLODConfig(zoom);

    // Viewport Culling & LOD filtreleme
    let culledFeatures = this.geojsonCollection.features.filter(f => isFeatureInBounds(f, bounds));
    if (culledFeatures.length > lod.maxFeatures) {
      culledFeatures = culledFeatures.slice(0, lod.maxFeatures);
    }

    // requestAnimationFrame ile render queue
    requestAnimationFrame(() => {
      if (!this.mapInstance || !this.isLayerVisible) return;
      this.clearLayersCustom();

      const layersToAdd: L.Layer[] = [];

      culledFeatures.forEach(feature => {
        let geom = feature.geometry;
        // LOD Geometri Sadeleştirme
        if (geom && lod.simplifyTolerance > 0 && (geom.type === 'Polygon' || geom.type === 'LineString' || geom.type === 'MultiPolygon')) {
           try {
             const simplified = turf.simplify(feature, { tolerance: lod.simplifyTolerance, highQuality: false });
             geom = simplified.geometry as Geometry;
           } catch {}
        }

        const featToRender: Feature = { ...feature, geometry: geom };

        // GeoJSON objesini Leaflet katmanına çevir
        const geojsonLayer = L.geoJSON(featToRender, {
          style: this.styleCallback ? () => this.styleCallback!(featToRender) : undefined,
          onEachFeature: this.onEachFeatureCallback,
          pointToLayer: (feat, latlng) => {
            return L.circleMarker(latlng, { radius: 6, fillColor: '#3b82f6', color: '#ffffff', weight: 1, fillOpacity: 0.8 });
          }
        });

        layersToAdd.push(geojsonLayer);
      });

      if (this.markerClusterGroup) {
        this.markerClusterGroup.addLayers(layersToAdd);
      } else {
        layersToAdd.forEach(l => super.addLayer(l));
      }
    });
  }
}
