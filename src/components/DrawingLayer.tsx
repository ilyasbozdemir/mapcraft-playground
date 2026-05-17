"use client";

import React, { useState, useCallback, useMemo, useEffect } from 'react';
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
import { Check, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

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

  useEffect(() => {
    setPoints([]);
    setMousePos(null);
    setSelectedPointIndices([]);
  }, [drawingMode]);

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
        const coords = (feature?.geometry as GeoJSON.Point).coordinates;
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

  const canFinish = useMemo(() => {
    if (drawingMode === 'polygon' || drawingMode === 'select-points') {
      return drawingMode === 'select-points' ? selectedPointIndices.length >= 3 : points.length >= 3;
    }
    if (drawingMode === 'line') return points.length >= 2;
    if (drawingMode === 'point') return points.length >= 1;
    return false;
  }, [drawingMode, points.length, selectedPointIndices.length]);

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
      if (drawingMode === 'none' || drawingMode === 'edit') return;
      
      if (drawingMode === 'select-points') return;

      const snapped = getSnappedPoint(e.latlng, map);

      if (snapped && points.length >= (drawingMode === 'polygon' ? 3 : 2)) {
        finishDrawing();
        return;
      }

      setPoints(prev => [...prev, e.latlng]);
    },
    mousemove(e) {
      if (drawingMode !== 'none' && drawingMode !== 'edit' && points.length > 0) {
        const snapped = getSnappedPoint(e.latlng, map);
        setMousePos(snapped || e.latlng);

        // Update live measurement
        if (drawingMode === 'polygon' && points.length >= 2) {
          const areaPoints = [...points, snapped || e.latlng, points[0]].map(p => [p.lng, p.lat]);
          try {
            const area = calculateArea(turf.polygon([areaPoints]));
            setMeasurementResult({ value: area, unit: 'm²', type: 'area' });
          } catch { }
        } else if (drawingMode === 'line' && points.length >= 1) {
          const totalDist = points.reduce((acc, p, i) => {
            if (i === 0) return 0;
            return acc + calculateDistance([points[i-1].lng, points[i-1].lat], [p.lng, p.lat]);
          }, 0);
          const lastDist = calculateDistance([points[points.length-1].lng, points[points.length-1].lat], [e.latlng.lng, e.latlng.lat]);
          setMeasurementResult({ value: totalDist + lastDist, unit: 'km', type: 'distance' });
        }
      }
    },
    dblclick() {
      if (drawingMode !== 'none' && drawingMode !== 'edit' && canFinish) {
        finishDrawing();
      }
    },
    contextmenu(e) {
      if (drawingMode !== 'none' && drawingMode !== 'edit') {
        L.DomEvent.stopPropagation(e.originalEvent);
        if (canFinish) {
          finishDrawing();
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

  if (drawingMode === 'none' || drawingMode === 'edit') return null;

  return (
    <>
      {/* Existing Points for selection mode */}
      {drawingMode === 'select-points' && layers.map(layer => 
        layer.visible && layer.data.features.map((f, i) => {
          if (f.geometry.type !== 'Point') return null;
          const coords = (f.geometry as GeoJSON.Point).coordinates;
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
      {points.map((p, i) => {
        const isFirst = i === 0;
        const isSnapped = mousePos && p.lat === mousePos.lat && p.lng === mousePos.lng;
        return (
          <CircleMarker 
            key={i} 
            center={p} 
            radius={isFirst && points.length >= 2 ? (isSnapped ? 12 : 8) : 5} 
            pathOptions={{ 
              color: isFirst && isSnapped ? '#22c55e' : 'white', 
              fillColor: isFirst && points.length >= 3 && drawingMode === 'polygon' ? '#22c55e' : '#3b82f6', 
              fillOpacity: 1, 
              weight: isFirst && isSnapped ? 4 : 2 
            }} 
          />
        );
      })}

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

      {/* Floating Status / Helper / Actions */}
      <div className="fixed bottom-32 left-1/2 -translate-x-1/2 z-2000 pointer-events-auto">
        <div className={cn(
          "px-4 py-2 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] backdrop-blur-xl border border-white/20 flex items-center gap-4 transition-all duration-300",
          drawingMode.startsWith('measure') ? "bg-primary/90 text-white" : "bg-background/90 text-foreground"
        )}>
          <div className="flex flex-col items-center min-w-[140px]">
            <span className="text-[10px] font-black uppercase tracking-widest opacity-70">
              {measurementResult?.type || (drawingMode === 'select-points' ? 'Selected' : 'Points')}
            </span>
            <span className="text-xl font-black tabular-nums">
              {measurementResult ? (
                measurementResult.type === 'area' 
                  ? (measurementResult.value > 1000000 ? (measurementResult.value / 1000000).toFixed(2) + ' km²' : measurementResult.value.toLocaleString() + ' m²')
                  : measurementResult.value.toFixed(3) + ' ' + (measurementResult.unit || 'km')
              ) : (
                drawingMode === 'select-points' ? selectedPointIndices.length : points.length
              )}
            </span>
            {(points.length > 0 || drawingMode === 'select-points') && !measurementResult && (
              <span className="text-[8px] font-bold uppercase tracking-widest opacity-50 mt-1 text-center">
                {drawingMode === 'select-points' ? 'Click points to select (3+ required)' : drawingMode === 'polygon' ? 'Click first point or right click to close' : 'Double click or right click to finish'}
              </span>
            )}
          </div>

          {/* Actions */}
          {!drawingMode.startsWith('measure') && (
            <div className="flex items-center gap-2 border-l border-white/10 pl-4">
              <Button 
                size="icon" 
                variant="ghost" 
                className="h-9 w-9 rounded-xl hover:bg-destructive/20 text-destructive transition-colors"
                onClick={() => {
                  clearDrawing();
                  setDrawingMode('none');
                  toast.error('Drawing cancelled');
                }}
              >
                <Trash2 className="w-5 h-5" />
              </Button>
              
              {canFinish && (
                <Button 
                  size="sm" 
                  className="h-9 px-4 rounded-xl bg-green-500 hover:bg-green-600 text-white flex items-center gap-2 shadow-lg transition-all active:scale-95"
                  onClick={finishDrawing}
                >
                  <Check className="w-5 h-5" />
                  <span className="text-xs font-bold uppercase tracking-tight">Confirm</span>
                </Button>
              )}

              {!canFinish && points.length > 0 && (
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight max-w-[80px] leading-tight opacity-50">
                   Need {drawingMode === 'polygon' ? '3+' : (drawingMode === 'line' ? '2+' : '1+')} points
                </div>
              )}
            </div>
          )}

          {drawingMode.startsWith('measure') && (
             <Button 
                size="icon" 
                variant="ghost" 
                className="h-8 w-8 rounded-full hover:bg-white/20 text-white"
                onClick={() => {
                  clearDrawing();
                  setDrawingMode('none');
                }}
              >
                <X className="w-4 h-4" />
              </Button>
          )}
        </div>
      </div>
    </>
  );
}
