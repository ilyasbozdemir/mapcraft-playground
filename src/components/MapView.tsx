"use client";

import React, { useEffect } from 'react';
import { 
  MapContainer, 
  TileLayer, 
  GeoJSON, 
  useMap,
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

function VertexEditor({ layer }: { layer: MapLayer }) {
  const updateLayer = useMapStore(state => state.updateLayer);

  const handleDragEnd = (featureIndex: number, coordIndex: number, latlng: L.LatLng, ringIndex: number = 0) => {
    const newData = JSON.parse(JSON.stringify(layer.data));
    const feature = newData.features[featureIndex];
    
    if (feature.geometry.type === 'LineString') {
      feature.geometry.coordinates[coordIndex] = [latlng.lng, latlng.lat];
    } else if (feature.geometry.type === 'Polygon') {
      feature.geometry.coordinates[ringIndex][coordIndex] = [latlng.lng, latlng.lat];
      
      // Close polygon if first or last point is moved
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
              // For polygons, skip the last point as it's a duplicate of the first
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

export default function MapView() {
  const { layers, selectedLayerId, baseLayer, customBaseUrl, drawingMode, setSelectedFeature, updateLayer } = useMapStore();

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
        
        {drawingMode === 'edit' && selectedLayerId && (
          <VertexEditor layer={layers.find(l => l.id === selectedLayerId)!} />
        )}
        
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
