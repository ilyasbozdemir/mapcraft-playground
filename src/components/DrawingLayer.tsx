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
  const [selectedVertices, setSelectedVertices] = useState<{
    layerId: string;
    featureIndex: number;
    coordIndex: number;
    coords: [number, number];
  }[]>([]);

  const clearDrawing = useCallback(() => {
    setPoints([]);
    setMousePos(null);
    setSelectedVertices([]);
    setMeasurementResult(null);
  }, [setMeasurementResult]);

  // Load selected layer's vertices when entering 'select-points' mode
  useEffect(() => {
    if (drawingMode === 'select-points') {
      const activeLayerId = useMapStore.getState().selectedLayerId;
      const activeLayer = layers.find(l => l.id === activeLayerId);
      if (activeLayer && activeLayer.visible) {
        const initialVertices: typeof selectedVertices = [];
        activeLayer.data.features.forEach((f, featureIndex) => {
          const geom = f.geometry;
          if (!geom) return;
          if (geom.type === 'Point') {
            initialVertices.push({
              layerId: activeLayer.id,
              featureIndex,
              coordIndex: 0,
              coords: geom.coordinates as [number, number]
            });
          } else if (geom.type === 'MultiPoint' || geom.type === 'LineString') {
            (geom.coordinates as [number, number][]).forEach((coords, coordIndex) => {
              initialVertices.push({
                layerId: activeLayer.id,
                featureIndex,
                coordIndex,
                coords
              });
            });
          } else if (geom.type === 'Polygon') {
            const outerRing = geom.coordinates[0] as [number, number][];
            const pointsToLoad = outerRing.slice(0, -1); // skip duplicate closing coordinate
            pointsToLoad.forEach((coords, coordIndex) => {
              initialVertices.push({
                layerId: activeLayer.id,
                featureIndex,
                coordIndex,
                coords
              });
            });
          }
        });
        
        const timer = setTimeout(() => {
          setSelectedVertices(initialVertices);
          if (initialVertices.length > 0) {
            toast.info(`${activeLayer.name} tabakasındaki ${initialVertices.length} nokta otomatik olarak seçildi.`);
          }
        }, 0);
        return () => clearTimeout(timer);
      }
    } else {
      const timer = setTimeout(() => {
        setPoints([]);
        setMousePos(null);
        setSelectedVertices([]);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [drawingMode, layers]);

  const finishDrawing = useCallback((finalPoints?: L.LatLng[]) => {
    if (drawingMode === 'measure-distance' || drawingMode === 'measure-area') {
       clearDrawing();
       setDrawingMode('none');
       return;
    }

    if (drawingMode === 'select-points') {
      if (selectedVertices.length < 3) {
        toast.error('Select at least 3 points to create a polygon');
        return;
      }

      const polygonPoints = selectedVertices.map(item => [item.coords[0], item.coords[1]]);

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

    const rawPoints = finalPoints || points;
    
    // Dedup consecutive identical coordinates (common on double click)
    const activePoints = rawPoints.filter((p, index) => {
      if (index === 0) return true;
      const prev = rawPoints[index - 1];
      return p.lat !== prev.lat || p.lng !== prev.lng;
    });

    if (activePoints.length < (drawingMode === 'polygon' ? 3 : drawingMode === 'line' ? 2 : 1)) {
      toast.error('Not enough points to create geometry');
      return;
    }

    let geojson: FeatureCollection;
    let name = '';

    if (drawingMode === 'polygon') {
      const coords = [...activePoints, activePoints[0]].map(p => [p.lng, p.lat]);
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
      const coords = activePoints.map(p => [p.lng, p.lat]);
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
        features: activePoints.map((p, i) => ({
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
  }, [points, drawingMode, addLayer, clearDrawing, setDrawingMode, setSelectedLayerId, selectedVertices]);

  const canFinish = useMemo(() => {
    if (drawingMode === 'polygon' || drawingMode === 'select-points') {
      return drawingMode === 'select-points' ? selectedVertices.length >= 3 : points.length >= 3;
    }
    if (drawingMode === 'line') return points.length >= 2;
    if (drawingMode === 'point') return points.length >= 1;
    return false;
  }, [drawingMode, points.length, selectedVertices.length]);

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
        const snapped = getSnappedPoint(e.latlng, map);
        const finalPoint = snapped || e.latlng;
        
        // Check if finalPoint is already identical to the last point to avoid duplicates
        const lastPoint = points[points.length - 1];
        const newPoints = lastPoint && lastPoint.lat === finalPoint.lat && lastPoint.lng === finalPoint.lng
          ? points
          : [...points, finalPoint];

        const reqCount = drawingMode === 'polygon' ? 3 : drawingMode === 'line' ? 2 : 1;
        if (newPoints.length >= reqCount) {
          finishDrawing(newPoints);
        } else {
          toast.error('Not enough points to create geometry');
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
      {/* Existing Points/Vertices for selection mode */}
      {drawingMode === 'select-points' && layers.map(layer => {
        if (!layer.visible) return null;
        return layer.data.features.map((f, featureIndex) => {
          const geom = f.geometry;
          if (!geom) return null;

          const isVertexSelected = (coordIndex: number) => {
            return selectedVertices.some(v => 
              v.layerId === layer.id && 
              v.featureIndex === featureIndex && 
              v.coordIndex === coordIndex
            );
          };

          const toggleVertex = (coordIndex: number, coords: [number, number]) => {
            setSelectedVertices(prev => {
              const exists = prev.some(v => 
                v.layerId === layer.id && 
                v.featureIndex === featureIndex && 
                v.coordIndex === coordIndex
              );
              if (exists) {
                return prev.filter(v => 
                  !(v.layerId === layer.id && 
                    v.featureIndex === featureIndex && 
                    v.coordIndex === coordIndex)
                );
              } else {
                return [...prev, {
                  layerId: layer.id,
                  featureIndex,
                  coordIndex,
                  coords
                }];
              }
            });
          };

          if (geom.type === 'Point') {
            const coords = geom.coordinates as [number, number];
            const isSelected = isVertexSelected(0);
            return (
              <CircleMarker 
                key={`${layer.id}-${featureIndex}-0`}
                center={[coords[1], coords[0]]}
                radius={8}
                eventHandlers={{
                  click: (e) => {
                    L.DomEvent.stopPropagation(e);
                    toggleVertex(0, coords);
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
          }

          if (geom.type === 'MultiPoint') {
            return (geom.coordinates as [number, number][]).map((coords, coordIndex) => {
              const isSelected = isVertexSelected(coordIndex);
              return (
                <CircleMarker 
                  key={`${layer.id}-${featureIndex}-${coordIndex}`}
                  center={[coords[1], coords[0]]}
                  radius={8}
                  eventHandlers={{
                    click: (e) => {
                      L.DomEvent.stopPropagation(e);
                      toggleVertex(coordIndex, coords);
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
            });
          }

          if (geom.type === 'LineString') {
            return (geom.coordinates as [number, number][]).map((coords, coordIndex) => {
              const isSelected = isVertexSelected(coordIndex);
              return (
                <CircleMarker 
                  key={`${layer.id}-${featureIndex}-${coordIndex}`}
                  center={[coords[1], coords[0]]}
                  radius={8}
                  eventHandlers={{
                    click: (e) => {
                      L.DomEvent.stopPropagation(e);
                      toggleVertex(coordIndex, coords);
                    }
                  }}
                  pathOptions={{
                    color: isSelected ? '#22c55e' : '#eab308',
                    fillColor: isSelected ? '#22c55e' : 'white',
                    fillOpacity: 0.8,
                    weight: 3
                  }}
                />
              );
            });
          }

          if (geom.type === 'Polygon') {
            const outerRing = geom.coordinates[0] as [number, number][];
            const pointsToRender = outerRing.slice(0, -1);
            return pointsToRender.map((coords, coordIndex) => {
              const isSelected = isVertexSelected(coordIndex);
              return (
                <CircleMarker 
                  key={`${layer.id}-${featureIndex}-${coordIndex}`}
                  center={[coords[1], coords[0]]}
                  radius={8}
                  eventHandlers={{
                    click: (e) => {
                      L.DomEvent.stopPropagation(e);
                      toggleVertex(coordIndex, coords);
                    }
                  }}
                  pathOptions={{
                    color: isSelected ? '#22c55e' : '#a855f7',
                    fillColor: isSelected ? '#22c55e' : 'white',
                    fillOpacity: 0.8,
                    weight: 3
                  }}
                />
              );
            });
          }

          return null;
        });
      })}

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
                drawingMode === 'select-points' ? selectedVertices.length : points.length
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
                  onClick={() => finishDrawing()}
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
