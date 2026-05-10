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
  const { layers, baseLayer, customBaseUrl, drawingMode } = useMapStore();

  const getStyle = (layer: MapLayer) => ({
    color: layer.color,
    weight: 2,
    opacity: 0.8,
    fillColor: layer.color,
    fillOpacity: 0.35,
  });

  const onEachFeature = (feature: Feature, leafletLayer: L.Layer) => {
    if (feature.properties) {
      const props = Object.entries(feature.properties)
        .map(([key, value]) => `
          <tr class="border-b border-border/50 last:border-0">
            <td class="py-1.5 pr-4 text-muted-foreground font-medium text-[11px] uppercase tracking-wider">${key}</td>
            <td class="py-1.5 text-foreground font-mono text-[11px] break-all">${typeof value === 'object' ? JSON.stringify(value) : value}</td>
          </tr>
        `)
        .join('');

      leafletLayer.bindPopup(`
        <div class="min-w-[240px] max-w-[320px]">
          <div class="flex items-center gap-2 mb-2 pb-2 border-b border-border">
            <div class="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
            <span class="font-bold text-sm uppercase tracking-tighter">${feature.geometry.type}</span>
          </div>
          <div class="max-h-[200px] overflow-auto custom-scrollbar">
            <table class="w-full text-left border-collapse">
              <tbody>${props || '<tr><td class="py-2 text-muted-foreground italic">No attributes</td></tr>'}</tbody>
            </table>
          </div>
        </div>
      `, {
        className: 'custom-leaflet-popup',
        maxWidth: 320
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
        className="w-full h-full z-0"
        zoomControl={false}
      >
        <TileLayer url={getTileUrl()} />
        <AutoFitBounds />
        <DrawingLayer />
        
        {layers.filter(l => l.visible).map((layer) => (
          <GeoJSON 
            key={`${layer.id}-${layer.color}`}
            data={layer.data}
            style={() => getStyle(layer)}
            pointToLayer={(feature, latlng) => {
              return L.marker(latlng, {
                title: feature.properties?.name || 'New Point',
                alt: 'Marker'
              });
            }}
            onEachFeature={onEachFeature}
          />
        ))}
      </MapContainer>
    </div>
  );
}
