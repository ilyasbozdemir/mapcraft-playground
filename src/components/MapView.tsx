"use client";

import React, { useEffect } from 'react';
import { 
  MapContainer, 
  TileLayer, 
  GeoJSON, 
  useMap
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

function AutoFitBounds() {
  const map = useMap();
  const layers = useMapStore((state) => state.layers);

  useEffect(() => {
    if (layers.length === 0) return;

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
  }, [layers, map]);

  return null;
}

const BASE_LAYERS = {
  osm: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  satellite: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  topo: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
  terrain: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer/tile/{z}/{y}/{x}"
};

export default function MapView() {
  const { layers, baseLayer, customBaseUrl, drawingMode, setSelectedFeature, updateLayer } = useMapStore();

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
          featureId: feature.id !== undefined ? feature.id : featureIndex.toString() 
        });
      }
    });
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
      >
        <TileLayer 
          url={getTileUrl()} 
          maxZoom={22} 
          maxNativeZoom={baseLayer === 'satellite' ? 19 : 18}
        />
        <AutoFitBounds />
        <DrawingLayer />
        
        {layers.filter(l => l.visible).map((layer) => (
          <GeoJSON 
            key={`${layer.id}-${layer.color}-${JSON.stringify(layer.data.features.length)}`}
            data={layer.data}
            style={() => getStyle(layer)}
            pointToLayer={(feature, latlng) => {
              const featureIndex = layer.data.features.findIndex(f => f === feature);
              return L.marker(latlng, {
                draggable: true,
                title: feature.properties?.name || 'Point',
              }).on('dragend', (e) => handleMarkerDragEnd(layer.id, featureIndex, e));
            }}
            onEachFeature={(feature, leafletLayer) => {
              const featureIndex = layer.data.features.findIndex(f => f === feature);
              onEachFeature(feature, leafletLayer, layer.id, featureIndex);
            }}
          />
        ))}
      </MapContainer>
    </div>
  );
}
