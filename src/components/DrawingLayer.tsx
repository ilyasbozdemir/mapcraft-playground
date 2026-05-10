"use client";

import React, { useState, useCallback } from 'react';
import { 
  useMapEvents, 
  Polyline, 
  Polygon, 
  CircleMarker 
} from 'react-leaflet';
import L from 'leaflet';
import { useMapStore } from '@/hooks/useMapStore';
import { MapLayer } from '@/types/geo';
import { toast } from 'sonner';
import { FeatureCollection } from 'geojson';

export function DrawingLayer() {
  const { drawingMode, setDrawingMode, addLayer } = useMapStore();
  const [points, setPoints] = useState<L.LatLng[]>([]);
  const [mousePos, setMousePos] = useState<L.LatLng | null>(null);

  const clearDrawing = useCallback(() => {
    setPoints([]);
    setMousePos(null);
  }, []);

  const finishDrawing = useCallback(() => {
    if (points.length < (drawingMode === 'polygon' ? 3 : drawingMode === 'line' ? 2 : 1)) {
      toast.error('Not enough points to create geometry');
      return;
    }

    let geojson: FeatureCollection;
    let name = '';

    if (drawingMode === 'polygon') {
      const coords = [...points, points[0]].map(p => [p.lng, p.lat]);
      geojson = {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: { name: 'New Polygon', createdAt: new Date().toISOString() },
          geometry: {
            type: 'Polygon',
            coordinates: [coords]
          }
        }]
      };
      name = 'New Polygon';
    } else if (drawingMode === 'line') {
      const coords = points.map(p => [p.lng, p.lat]);
      geojson = {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: { name: 'New Line', createdAt: new Date().toISOString() },
          geometry: {
            type: 'LineString',
            coordinates: coords
          }
        }]
      };
      name = 'New Line';
    } else {
      geojson = {
        type: 'FeatureCollection',
        features: points.map((p, i) => ({
          type: 'Feature',
          properties: { name: `New Point ${i + 1}`, createdAt: new Date().toISOString() },
          geometry: {
            type: 'Point',
            coordinates: [p.lng, p.lat]
          }
        }))
      };
      name = 'New Points';
    }

    const newLayer: MapLayer = {
      id: crypto.randomUUID(),
      name: `${name} ${new Date().toLocaleTimeString()}`,
      type: 'geojson',
      data: geojson,
      visible: true,
      color: '#' + Math.floor(Math.random()*16777215).toString(16),
      geometryType: drawingMode.charAt(0).toUpperCase() + drawingMode.slice(1) as any,
      featureCount: geojson.features.length,
      size: JSON.stringify(geojson).length,
      createdAt: Date.now(),
    };

    addLayer(newLayer);
    toast.success(`Created ${name}`);
    clearDrawing();
    setDrawingMode('none');
  }, [points, drawingMode, addLayer, clearDrawing, setDrawingMode]);

  useMapEvents({
    click(e) {
      if (drawingMode === 'none') return;
      
      if (drawingMode === 'point') {
        const newPoints = [...points, e.latlng];
        // For points, we might want to finish immediately or keep adding.
        // Let's keep adding until they press finish (or ESC).
        setPoints(newPoints);
      } else {
        setPoints(prev => [...prev, e.latlng]);
      }
    },
    mousemove(e) {
      if (drawingMode !== 'none' && points.length > 0) {
        setMousePos(e.latlng);
      }
    },
    keydown(e) {
      if (e.originalEvent.key === 'Escape') {
        clearDrawing();
        setDrawingMode('none');
      } else if (e.originalEvent.key === 'Enter') {
        finishDrawing();
      }
    }
  });

  if (drawingMode === 'none') return null;

  return (
    <>
      {/* Current Points */}
      {points.map((p, i) => (
        <CircleMarker 
          key={i} 
          center={p} 
          radius={5} 
          pathOptions={{ color: 'white', fillColor: '#3b82f6', fillOpacity: 1, weight: 2 }} 
        />
      ))}

      {/* Preview Line/Polygon */}
      {drawingMode === 'line' && points.length > 0 && (
        <Polyline 
          positions={mousePos ? [...points, mousePos] : points} 
          pathOptions={{ color: '#3b82f6', weight: 3, dashArray: '5, 10' }} 
        />
      )}

      {drawingMode === 'polygon' && points.length > 0 && (
        <Polygon 
          positions={mousePos ? [...points, mousePos] : points} 
          pathOptions={{ color: '#3b82f6', weight: 2, fillOpacity: 0.2, dashArray: '5, 10' }} 
        />
      )}

      {/* Finish Button Tooltip/Helper */}
      {points.length > 0 && (
        <div className="fixed bottom-32 left-1/2 -translate-x-1/2 z-2000 pointer-events-none">
          <div className="bg-primary text-primary-foreground px-4 py-2 rounded-full shadow-2xl flex items-center gap-3 animate-bounce">
            <span className="text-xs font-bold uppercase tracking-widest">
              {points.length} points • Press Enter to Finish • Esc to Cancel
            </span>
          </div>
        </div>
      )}
    </>
  );
}
