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
import { MapLayer, GeometryType } from '@/types/geo';
import { toast } from 'sonner';
import { FeatureCollection } from 'geojson';
import { cn } from '@/lib/utils';

import * as turf from '@turf/turf';
import { calculateDistance, calculateArea, pointsToPolygon } from '@/lib/TurfUtils';

export function DrawingLayer() {
  const { 
    drawingMode, 
    setDrawingMode, 
    addLayer, 
    setSelectedLayerId, 
    measurementResult, 
    setMeasurementResult,
    layers
  } = useMapStore();
  const [points, setPoints] = useState<L.LatLng[]>([]);
  const [mousePos, setMousePos] = useState<L.LatLng | null>(null);
  const [selectedPointIndices, setSelectedPointIndices] = useState<{ layerId: string; index: number }[]>([]);

  const clearDrawing = useCallback(() => {
    setPoints([]);
    setMousePos(null);
    setSelectedPointIndices([]);
    setMeasurementResult(null);
  }, [setMeasurementResult]);

  const finishDrawing = useCallback(() => {
    if (drawingMode === 'measure-distance' || drawingMode === 'measure-area') {
       clearDrawing();
       setDrawingMode('none');
       return;
    }

    if (drawingMode === 'select-points') {
      if (selectedPointIndices.length < 3) {
        toast.error('Select at least 3 points to create a polygon');
        return;
      }

      const polygonPoints = selectedPointIndices.map(item => {
        const layer = layers.find(l => l.id === item.layerId);
        const feature = layer?.data.features[item.index];
        const coords = (feature?.geometry as any).coordinates;
        return [coords[0], coords[1]];
      });

      const polygon = pointsToPolygon(polygonPoints as number[][]);
      if (polygon) {
        const newLayer: MapLayer = {
          id: crypto.randomUUID(),
          name: `Derived Polygon ${new Date().toLocaleTimeString()}`,
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [polygon] },
          visible: true,
          color: '#' + Math.floor(Math.random()*16777215).toString(16),
          geometryType: 'Polygon',
          featureCount: 1,
          size: JSON.stringify(polygon).length,
          createdAt: Date.now(),
        };
        addLayer(newLayer);
        toast.success('Polygon created from selected points');
      }
      clearDrawing();
      setDrawingMode('none');
      return;
    }

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
      name = 'New Point';
    }

    const newLayer: MapLayer = {
      id: crypto.randomUUID(),
      name: `${name} ${new Date().toLocaleTimeString()}`,
      type: 'geojson',
      data: geojson,
      visible: true,
      color: '#' + Math.floor(Math.random()*16777215).toString(16),
      geometryType: (drawingMode === 'line' ? 'LineString' : drawingMode === 'polygon' ? 'Polygon' : drawingMode === 'point' ? 'Point' : 'Mixed') as GeometryType | "Mixed",
      featureCount: geojson.features.length,
      size: JSON.stringify(geojson).length,
      createdAt: Date.now(),
    };

    addLayer(newLayer);
    setSelectedLayerId(newLayer.id);
    toast.success(`Created ${name}`);
    clearDrawing();
    setDrawingMode('none');
  }, [points, drawingMode, addLayer, clearDrawing, setDrawingMode, setSelectedLayerId, selectedPointIndices, layers]);

  const SNAP_THRESHOLD = 20; // pixels

  const getSnappedPoint = useCallback((latlng: L.LatLng, mapInstance: L.Map) => {
    if (points.length === 0) return null;

    const mousePoint = mapInstance.latLngToContainerPoint(latlng);
    
    // Check snapping to the first point
    const firstPoint = mapInstance.latLngToContainerPoint(points[0]);
    const dist = mousePoint.distanceTo(firstPoint);

    if (dist < SNAP_THRESHOLD) {
      return points[0];
    }

    return null;
  }, [points]);

  const map = useMapEvents({
    click(e) {
      if (drawingMode === 'none') return;
      
      if (drawingMode === 'select-points') {
        // Point selection logic is handled via CircleMarkers in the render
        return;
      }

      const snapped = getSnappedPoint(e.latlng, map);

      if (snapped && points.length >= (drawingMode === 'polygon' ? 3 : 2)) {
        finishDrawing();
        return;
      }

      setPoints(prev => {
        const newPoints = [...prev, e.latlng];
        
        if (drawingMode === 'measure-distance' && newPoints.length >= 2) {
          const dist = calculateDistance(
            [newPoints[newPoints.length-2].lng, newPoints[newPoints.length-2].lat],
            [newPoints[newPoints.length-1].lng, newPoints[newPoints.length-1].lat]
          );
          setMeasurementResult({ 
            value: (measurementResult?.value || 0) + dist, 
            unit: 'km', 
            type: 'distance' 
          });
        }
        
        return newPoints;
      });
    },
    mousemove(e) {
      if (drawingMode !== 'none' && points.length > 0) {
        const snapped = getSnappedPoint(e.latlng, map);
        setMousePos(snapped || e.latlng);

        if (drawingMode === 'measure-area' && points.length >= 2) {
          const areaPoints = [...points, e.latlng, points[0]].map(p => [p.lng, p.lat]);
          try {
            const area = calculateArea(turf.polygon([areaPoints]));
            setMeasurementResult({ value: area, unit: 'm²', type: 'area' });
          } catch (e) {}
        }
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
      {/* Existing Points for selection mode */}
      {drawingMode === 'select-points' && layers.map(layer => 
        layer.visible && layer.data.features.map((f, i) => {
          if (f.geometry.type !== 'Point') return null;
          const coords = (f.geometry as any).coordinates;
          const isSelected = selectedPointIndices.some(s => s.layerId === layer.id && s.index === i);
          
          return (
            <CircleMarker 
              key={`${layer.id}-${i}`}
              center={[coords[1], coords[0]]}
              radius={8}
              eventHandlers={{
                click: (e) => {
                  L.DomEvent.stopPropagation(e);
                  if (isSelected) {
                    setSelectedPointIndices(prev => prev.filter(s => !(s.layerId === layer.id && s.index === i)));
                  } else {
                    setSelectedPointIndices(prev => [...prev, { layerId: layer.id, index: i }]);
                  }
                }
              }}
              pathOptions={{
                color: isSelected ? '#22c55e' : '#3b82f6',
                fillColor: isSelected ? '#22c55e' : 'white',
                fillOpacity: 0.8,
                weight: 3
              }}
            />
          );
        })
      )}

      {/* Current Points */}
      {points.map((p, i) => (
        <CircleMarker 
          key={i} 
          center={p} 
          radius={i === 0 && points.length >= 2 ? 8 : 5} 
          pathOptions={{ 
            color: 'white', 
            fillColor: i === 0 && points.length >= 3 && drawingMode === 'polygon' ? '#22c55e' : '#3b82f6', 
            fillOpacity: 1, 
            weight: 2 
          }} 
        />
      ))}

      {/* Preview Line/Polygon */}
      {(drawingMode === 'line' || drawingMode === 'measure-distance') && points.length > 0 && (
        <Polyline 
          positions={mousePos ? [...points, mousePos] : points} 
          pathOptions={{ color: '#3b82f6', weight: 3, dashArray: '5, 10' }} 
        />
      )}

      {(drawingMode === 'polygon' || drawingMode === 'measure-area') && points.length > 0 && (
        <Polygon 
          positions={mousePos ? [...points, mousePos] : points} 
          pathOptions={{ color: '#3b82f6', weight: 2, fillOpacity: 0.2, dashArray: '5, 10' }} 
        />
      )}

      {/* Floating Status / Helper */}
      <div className="fixed bottom-32 left-1/2 -translate-x-1/2 z-2000 pointer-events-none">
        <div className={cn(
          "px-6 py-3 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] backdrop-blur-xl border border-white/20 flex flex-col items-center gap-1 transition-all duration-300",
          drawingMode.startsWith('measure') ? "bg-primary/90 text-white" : "bg-background/90 text-foreground"
        )}>
          {measurementResult ? (
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-black uppercase tracking-widest opacity-70">{measurementResult.type}</span>
              <span className="text-xl font-black tabular-nums">
                {measurementResult.type === 'area' 
                  ? (measurementResult.value > 1000000 ? (measurementResult.value / 1000000).toFixed(2) + ' km²' : measurementResult.value.toLocaleString() + ' m²')
                  : measurementResult.value.toFixed(3) + ' ' + measurementResult.unit}
              </span>
            </div>
          ) : (
            <span className="text-xs font-bold uppercase tracking-widest">
              {drawingMode === 'select-points' 
                ? `Selected ${selectedPointIndices.length} points • Enter to Create Polygon`
                : `${points.length} points • Enter to Finish • Esc to Cancel`}
            </span>
          )}
        </div>
      </div>
    </>
  );
}
