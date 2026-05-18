"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { 
  MapContainer, 
  TileLayer, 
  GeoJSON, 
  useMap,
  useMapEvents,
  Marker
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useMapStore } from '@/hooks/useMapStore';
import { Feature } from 'geojson';
import { calculateBounds } from '@/lib/geoUtils';
import { cn } from '@/lib/utils';
import { DrawingLayer } from './DrawingLayer';
import { toast } from 'sonner';
import { MapLayer } from '@/types/geo';

// Fix Leaflet marker icons
if (typeof window !== 'undefined') {
  // @ts-expect-error - Leaflet icon internal property
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  });
}

// O(1) Karmaşıklığında Feature Index Önbelleklemesi
const featureIndexCache = new WeakMap<any, number>();
const getFeatureIndex = (features: any[], feature: any): number => {
  if (feature.id !== undefined) return Number(feature.id);
  if (featureIndexCache.has(feature)) return featureIndexCache.get(feature)!;
  const idx = features.indexOf(feature);
  featureIndexCache.set(feature, idx);
  return idx;
};

// Hızlı Bounding Box / Viewport Kesişim Kontrolü (Culling için)
function isFeatureInBoundsFast(feature: Feature, bounds: L.LatLngBounds): boolean {
  if (!feature.geometry) return false;
  try {
    const geom = feature.geometry;
    let coords: any[] = [];
    if (geom.type === 'Point') {
      const [lng, lat] = geom.coordinates;
      return bounds.contains([lat, lng]);
    } else if (geom.type === 'LineString' || geom.type === 'MultiPoint') {
      coords = geom.coordinates;
    } else if (geom.type === 'Polygon' || geom.type === 'MultiLineString') {
      coords = geom.coordinates[0]; // outer ring
    } else if (geom.type === 'MultiPolygon') {
      coords = geom.coordinates[0][0];
    }
    
    if (!coords || coords.length === 0) return true;

    // Örnekleme yöntemiyle en az bir noktanın ekranda olup olmadığını kontrol et
    for (let i = 0; i < Math.min(coords.length, 20); i += Math.max(1, Math.floor(coords.length / 20))) {
      const pt = coords[i];
      if (pt && pt.length >= 2) {
        if (bounds.contains([pt[1], pt[0]])) return true;
      }
    }
    return false;
  } catch {
    return true; // Hata durumunda güvenli tarafta kal ve render et
  }
}

function AutoFitBounds() {
  const map = useMap();
  const { layers, isLoading } = useMapStore();

  useEffect(() => {
    if (isLoading || layers.length === 0) return;

    const allFeatures = layers
      .filter(l => l.visible)
      .flatMap(l => l.data.features);

    if (allFeatures.length === 0) return;

    const bounds = calculateBounds({ type: 'FeatureCollection', features: allFeatures });
    if (bounds) {
      map.fitBounds([
        [bounds[0], bounds[1]],
        [bounds[2], bounds[3]]
      ], { padding: [50, 50], animate: true });
    }
  }, [layers, isLoading, map]);

  return null;
}

function FeatureFocus() {
  const map = useMap();
  const { selectedFeature, layers } = useMapStore();

  useEffect(() => {
    if (!selectedFeature) return;

    const layer = layers.find(l => l.id === selectedFeature.layerId);
    if (!layer) return;

    const feature = layer.data.features.find((f, i) => {
      if (f.id !== undefined && f.id.toString() === selectedFeature.featureId.toString()) return true;
      if (i.toString() === selectedFeature.featureId.toString()) return true;
      return false;
    });

    if (!feature) return;

    // Ekranın solunda 320px LayerPanel, sağında 320px FeatureDetails penceresi var.
    // Elemanın panellerin altında kalmaması (ortalanması) için dinamik padding uyguluyoruz.
    const paddingOpts: import('leaflet').FitBoundsOptions = {
      paddingTopLeft: [340, 50],     // Sol panel payı + üst boşluk
      paddingBottomRight: [340, 50], // Sağ panel payı + alt boşluk
      maxZoom: 18,
      animate: true,
      duration: 1.5
    };

    if (feature.geometry.type === 'Point') {
      const coords = (feature.geometry as import('geojson').Point).coordinates;
      const offset = 0.0005; // Nokta etrafında küçük bir sanal kutu (yaklaşık 50m)
      map.fitBounds([
        [coords[1] - offset, coords[0] - offset],
        [coords[1] + offset, coords[0] + offset]
      ], paddingOpts);
    } else {
      const bounds = calculateBounds({ type: 'FeatureCollection', features: [feature] });
      if (bounds) {
        map.fitBounds([
          [bounds[0], bounds[1]],
          [bounds[2], bounds[3]]
        ], paddingOpts);
      }
    }
  }, [selectedFeature, layers, map]);

  return null;
}

// Harita Viewport (Zoom, Pan, Bounds) Takipçisi
function ViewportTracker({ 
  onViewportChange 
}: { 
  onViewportChange: (vp: { zoom: number; center: [number, number]; bounds: L.LatLngBounds }) => void 
}) {
  const map = useMapEvents({
    moveend: () => {
      onViewportChange({
        zoom: Number(map.getZoom().toFixed(1)),
        center: [Number(map.getCenter().lat.toFixed(5)), Number(map.getCenter().lng.toFixed(5))],
        bounds: map.getBounds(),
      });
    },
    zoomend: () => {
      onViewportChange({
        zoom: Number(map.getZoom().toFixed(1)),
        center: [Number(map.getCenter().lat.toFixed(5)), Number(map.getCenter().lng.toFixed(5))],
        bounds: map.getBounds(),
      });
    },
  });

  useEffect(() => {
    onViewportChange({
      zoom: Number(map.getZoom().toFixed(1)),
      center: [Number(map.getCenter().lat.toFixed(5)), Number(map.getCenter().lng.toFixed(5))],
      bounds: map.getBounds(),
    });
  }, [map, onViewportChange]);

  return null;
}

const BASE_LAYERS = {
  osm: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  satellite: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  topo: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
  terrain: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer/tile/{z}/{y}/{x}"
};

function VertexEditor({ layer }: { layer: MapLayer }) {
  const updateLayer = useMapStore(state => state.updateLayer);

  if (!layer || !layer.color) return null;

  const handleDragEnd = (featureIndex: number, coordIndex: number, latlng: L.LatLng, ringIndex: number = 0) => {
    const newData = JSON.parse(JSON.stringify(layer.data));
    const feature = newData.features[featureIndex];
    
    if (feature.geometry.type === 'LineString') {
      feature.geometry.coordinates[coordIndex] = [latlng.lng, latlng.lat];
    } else if (feature.geometry.type === 'Polygon') {
      feature.geometry.coordinates[ringIndex][coordIndex] = [latlng.lng, latlng.lat];
      
      if (coordIndex === 0) {
        feature.geometry.coordinates[ringIndex][feature.geometry.coordinates[ringIndex].length - 1] = [latlng.lng, latlng.lat];
      } else if (coordIndex === feature.geometry.coordinates[ringIndex].length - 1) {
        feature.geometry.coordinates[ringIndex][0] = [latlng.lng, latlng.lat];
      }
    }

    updateLayer(layer.id, { data: newData });
    toast.success('Vertex updated');
  };

  const vertexIcon = L.divIcon({
    className: 'vertex-marker',
    html: `<div style="background-color: white; border: 2px solid ${layer.color}; width: 10px; height: 10px; border-radius: 50%; shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
    iconSize: [10, 10],
    iconAnchor: [5, 5]
  });

  return (
    <>
      {layer.data.features.map((feature, fIndex) => {
        if (feature.geometry.type === 'LineString') {
          return feature.geometry.coordinates.map((coord: GeoJSON.Position, cIndex: number) => (
            <Marker
              key={`${layer.id}-${fIndex}-${cIndex}`}
              position={[coord[1], coord[0]]}
              draggable
              icon={vertexIcon}
              eventHandlers={{
                dragend: (e) => handleDragEnd(fIndex, cIndex, e.target.getLatLng())
              }}
            />
          ));
        }
        if (feature.geometry.type === 'Polygon') {
          return feature.geometry.coordinates.map((ring: GeoJSON.Position[], rIndex: number) => 
            ring.map((coord: GeoJSON.Position, cIndex: number) => {
              if (cIndex === ring.length - 1) return null;
              
              return (
                <Marker
                  key={`${layer.id}-${fIndex}-${rIndex}-${cIndex}`}
                  position={[coord[1], coord[0]]}
                  draggable
                  icon={vertexIcon}
                  eventHandlers={{
                    dragend: (e) => handleDragEnd(fIndex, cIndex, e.target.getLatLng(), rIndex)
                  }}
                />
              );
            })
          );
        }
        return null;
      })}
    </>
  );
}

function MVTVectorGridLayer({ layer }: { layer: MapLayer }) {
  const map = useMap();

  useEffect(() => {
    if (!layer.visible || !layer.mvtUrl) return;

    try {
      const vectorGrid = L.vectorGrid.protobuf(layer.mvtUrl, {
        vectorTileLayerStyles: {
          sliced: {
            weight: 1,
            fillColor: layer.color || '#3b82f6',
            color: layer.color || '#1d4ed8',
            fillOpacity: 0.6,
            fill: true
          }
        },
        interactive: true,
        getFeatureId: (f: any) => f.properties?.id || f.id || crypto.randomUUID(),
      });

      vectorGrid.on('click', (e: any) => {
        if (e.layer && e.layer.properties) {
          toast.info(`MVT Obje Tıklandı: ${e.layer.properties.name || e.layer.properties.id || 'Nitelik Tablosunda'}`);
        }
      });

      vectorGrid.addTo(map);

      return () => {
        map.removeLayer(vectorGrid);
      };
    } catch (err) {
      console.error('MVT VectorGrid error:', err);
    }
  }, [layer, map]);

  return null;
}

export default function MapView() {
  const { layers, selectedLayerId, baseLayer, customBaseUrl, drawingMode, setSelectedFeature, updateLayer } = useMapStore();
  
  // Harita Viewport ve LOD Durumu
  const [viewport, setViewport] = useState<{ zoom: number; center: [number, number]; bounds: L.LatLngBounds | null }>({
    zoom: 6,
    center: [39, 35],
    bounds: null,
  });

  const handleViewportChange = useCallback((vp: { zoom: number; center: [number, number]; bounds: L.LatLngBounds }) => {
    setViewport(vp);
  }, []);

  // LOD (Level of Detail) Kuralları
  const getLODInfo = (zoom: number) => {
    if (zoom < 8) return { label: 'Makro Ölçek (Max 500 Obje)', max: 500 };
    if (zoom >= 8 && zoom < 11) return { label: 'Bölgesel Ölçek (Max 2000 Obje)', max: 2000 };
    if (zoom >= 11 && zoom < 14) return { label: 'Şehir Ölçeği (Max 5000 Obje)', max: 5000 };
    return { label: 'Mahalle/Parsel Ölçeği (Tüm Objeler)', max: Infinity };
  };

  const lodInfo = getLODInfo(viewport.zoom);

  // Viewport Culling & LOD Filtrelemesi Uygulanmış Katmanlar (MVT hariç)
  const visibleLayers = layers.filter(l => l.visible && l.type !== 'mvt').map(layer => {
    if (!viewport.bounds || layer.data.features.length <= 500) {
      return { ...layer, culledData: layer.data, renderedCount: layer.data.features.length, totalCount: layer.data.features.length };
    }

    // Sadece ekrandaki (bounds içindeki) objeleri filtrele
    const culled = layer.data.features.filter(f => isFeatureInBoundsFast(f, viewport.bounds!));
    // LOD limitini uygula
    const limited = culled.length > lodInfo.max ? culled.slice(0, lodInfo.max) : culled;

    return {
      ...layer,
      culledData: { ...layer.data, features: limited },
      renderedCount: limited.length,
      totalCount: layer.data.features.length
    };
  });

  const getStyle = (layer: MapLayer) => ({
    color: layer.color,
    weight: 2,
    opacity: 0.8,
    fillColor: layer.color,
    fillOpacity: 0.35,
  });

  const handleMarkerDragEnd = (layerId: string, featureIndex: number, e: L.LeafletEvent) => {
    const marker = e.target;
    const position = marker.getLatLng();
    
    const layer = layers.find(l => l.id === layerId);
    if (!layer) return;

    const newData = { ...layer.data };
    const feature = { ...newData.features[featureIndex] };
    
    if (feature.geometry.type === 'Point') {
      feature.geometry = {
        ...feature.geometry,
        coordinates: [position.lng, position.lat]
      };
      
      newData.features[featureIndex] = feature;
      updateLayer(layerId, { data: newData });
      toast.success('Point moved');
    }
  };

  const onEachFeature = (feature: Feature, leafletLayer: L.Layer, layerId: string, featureIndex: number) => {
    leafletLayer.on({
      click: (e) => {
        if (drawingMode !== 'none') return;
        L.DomEvent.stopPropagation(e);
        setSelectedFeature({ 
          layerId, 
          featureId: featureIndex.toString() 
        });
      }
    });

    // Poligon / Çizgi / Nokta üzerine isim (name) basma mantığı
    const props = feature.properties || {};
    const name = props.name || props.Name || props.title || props.id || '';
    if (name) {
      leafletLayer.bindTooltip(String(name), {
        permanent: viewport.zoom >= 18, // 18 zoom ve üzerinde kalıcı göster
        direction: 'center',
        className: 'polygon-label bg-background/85 backdrop-blur-xs text-[9.5px] font-bold px-1.5 py-0.5 rounded border border-primary/30 shadow-xs text-foreground font-mono pointer-events-none'
      });
    }
  };

  const getTileUrl = () => {
    if (baseLayer === 'custom' && customBaseUrl) return customBaseUrl;
    return BASE_LAYERS[baseLayer as keyof typeof BASE_LAYERS] || BASE_LAYERS.osm;
  };

  return (
    <div className={cn("w-full h-full relative", drawingMode !== 'none' && "cursor-crosshair")}>
      <MapContainer 
        center={[39, 35]} 
        zoom={6} 
        maxZoom={22}
        className="w-full h-full z-0"
        zoomControl={false}
        preferCanvas={true}
      >
        <TileLayer 
          url={getTileUrl()} 
          maxZoom={22} 
          maxNativeZoom={baseLayer === 'satellite' ? 19 : 18}
        />
        <ViewportTracker onViewportChange={handleViewportChange} />
        <AutoFitBounds />
        <FeatureFocus />
        <DrawingLayer />
        
        {drawingMode === 'edit' && selectedLayerId && layers.find(l => l.id === selectedLayerId) && (
          <VertexEditor layer={layers.find(l => l.id === selectedLayerId)!} />
        )}
        
        {layers.filter(l => l.visible && l.type === 'mvt').map(layer => (
          <MVTVectorGridLayer key={layer.id} layer={layer} />
        ))}

        {visibleLayers.map((layer) => (
          <GeoJSON 
            key={`${layer.id}-${layer.color}-${drawingMode}-${layer.renderedCount}-${viewport.zoom}`}
            data={layer.culledData}
            style={() => getStyle(layer)}
            pointToLayer={(feature, latlng) => {
              if (drawingMode === 'select-points') {
                return L.circleMarker(latlng, { radius: 0, opacity: 0, fillOpacity: 0, interactive: false });
              }
              const featureIndex = getFeatureIndex(layer.data.features, feature);
              return L.marker(latlng, {
                draggable: drawingMode === 'edit',
                title: feature.properties?.name || 'Point',
              }).on('dragend', (e) => handleMarkerDragEnd(layer.id, featureIndex, e));
            }}
            onEachFeature={(feature, leafletLayer) => {
              const featureIndex = getFeatureIndex(layer.data.features, feature);
              onEachFeature(feature, leafletLayer, layer.id, featureIndex);
            }}
          />
        ))}
      </MapContainer>

      {/* Studio Viewport HUD (Heads-Up Display) Paneli */}
      <div className="absolute bottom-6 right-6 z-[1000] bg-background/85 backdrop-blur-md border border-border/60 p-4 rounded-2xl shadow-2xl flex flex-col gap-2 text-xs font-mono min-w-[280px] pointer-events-auto">
        <div className="flex items-center justify-between border-b border-border/50 pb-2">
          <span className="font-semibold text-primary flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            GIS STUDIO ENGINE v1.2
          </span>
          <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-sans font-medium">
            {lodInfo.label.split(' ')[0]}
          </span>
        </div>
        
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pt-1">
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground">ZOOM SEVİYESİ</span>
            <span className="font-bold text-foreground">{viewport.zoom}x</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground">MERKEZ (PAN)</span>
            <span className="font-bold text-foreground truncate">{viewport.center[0].toFixed(4)}, {viewport.center[1].toFixed(4)}</span>
          </div>
          <div className="flex flex-col col-span-2 pt-1 border-t border-border/30">
            <span className="text-[10px] text-muted-foreground">LOD & CULLING DURUMU</span>
            <span className="font-medium text-foreground">{lodInfo.label}</span>
          </div>
          {visibleLayers.map(l => (
            <div key={l.id} className="flex items-center justify-between col-span-2 text-[11px] bg-accent/50 px-2 py-1 rounded">
              <span className="truncate max-w-[140px] text-muted-foreground">{l.name}:</span>
              <span className="font-bold text-primary">{l.renderedCount} / {l.totalCount} render</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
