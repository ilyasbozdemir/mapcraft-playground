"use client";

import React, { useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  GripHorizontal, 
  MapPin, 
  Maximize2, 
  Copy, 
  Trash2, 
  Box, 
  Activity, 
  Plus, 
  TrendingUp
} from 'lucide-react';
import { Button } from './ui/button';
import { useMapStore } from '@/hooks/useMapStore';
import { toast } from 'sonner';
import { calculateArea, calculateLength } from '@/lib/TurfUtils';
import { cn } from '@/lib/utils';

export function FeatureDetailsWindow() {
  const { selectedFeature, layers, setSelectedFeature, updateLayer } = useMapStore();
  const [newPropKey, setNewPropKey] = useState('');
  const [isAddingProp, setIsAddingProp] = useState(false);
  const constraintsRef = useRef(null);

  const layer = useMemo(() => 
    layers.find((l): l is import('@/types/geo').MapLayer => l.id === selectedFeature?.layerId),
    [layers, selectedFeature]
  );

  const feature = useMemo(() => 
    layer?.data.features.find((f, i) => 
      (f.id !== undefined ? f.id === selectedFeature?.featureId : i.toString() === selectedFeature?.featureId.toString())
    ),
    [layer, selectedFeature]
  );

  const stats = useMemo(() => {
    if (!feature) return null;
    if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
      const area = calculateArea(feature as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>);
      const perimeter = calculateLength(feature as GeoJSON.Feature<GeoJSON.Geometry>, 'kilometers');
      return [
        { label: 'Area', value: area > 1000000 ? (area / 1000000).toFixed(2) + ' km²' : area.toLocaleString() + ' m²' },
        { label: 'Perimeter', value: perimeter.toFixed(3) + ' km' }
      ];
    } else if (feature.geometry.type === 'LineString' || feature.geometry.type === 'MultiLineString') {
      const length = calculateLength(feature as GeoJSON.Feature<GeoJSON.Geometry>, 'kilometers');
      return [{ label: 'Length', value: length.toFixed(3) + ' km' }];
    }
    return null;
  }, [feature]);

  if (!selectedFeature || !layer || !feature) return null;

  const properties = feature.properties || {};

  const handleCopyProperties = () => {
    navigator.clipboard.writeText(JSON.stringify(properties, null, 2));
    toast.success('Properties copied to clipboard');
  };

  const handleUpdateProperty = (key: string, value: any) => {
    const newProps = { ...properties, [key]: value };
    const newData = {
      ...layer.data,
      features: layer.data.features.map((f, i) => 
        (f.id !== undefined ? f.id === selectedFeature.featureId : i.toString() === selectedFeature.featureId.toString())
          ? { ...f, properties: newProps }
          : f
      )
    };
    updateLayer(layer.id, { data: newData });
  };

  const handleAddProperty = () => {
    if (!newPropKey) return;
    if (properties[newPropKey] !== undefined) {
      toast.error('Property already exists');
      return;
    }
    handleUpdateProperty(newPropKey, '');
    setNewPropKey('');
    setIsAddingProp(false);
    toast.success('Attribute added');
  };

  const handleRemoveProperty = (key: string) => {
    const newProps = { ...properties };
    delete newProps[key];
    const newData = {
      ...layer.data,
      features: layer.data.features.map((f, i) => 
        (f.id !== undefined ? f.id === selectedFeature.featureId : i.toString() === selectedFeature.featureId.toString())
          ? { ...f, properties: newProps }
          : f
      )
    };
    updateLayer(layer.id, { data: newData });
    toast.success('Attribute removed');
  };

  const handleRemoveFeature = () => {
    const newData = {
      ...layer.data,
      features: layer.data.features.filter((f, i) => 
        (f.id !== undefined ? f.id !== selectedFeature.featureId : i.toString() !== selectedFeature.featureId.toString())
      )
    };
    
    updateLayer(layer.id, { 
      data: newData,
      featureCount: newData.features.length 
    });
    
    setSelectedFeature(null);
    toast.success('Feature removed');
  };

  return (
    <div 
      className="absolute inset-0 z-1001 pointer-events-none" 
      ref={constraintsRef}
    >
      <motion.div
        drag
        dragMomentum={false}
        dragConstraints={constraintsRef}
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="pointer-events-auto absolute top-24 right-6 w-80 bg-background/90 backdrop-blur-xl border border-border rounded-2xl shadow-[0_32px_64px_-12px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col max-h-[75vh]"
      >
        {/* Header/Handle */}
        <div className="p-3 border-b border-border flex items-center justify-between bg-muted/30 cursor-grab active:cursor-grabbing">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Box className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight leading-tight">Feature Details</h3>
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{feature.geometry.type}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 rounded-lg hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setSelectedFeature(null)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Drag Handle Indicator */}
        <div className="flex justify-center py-1 opacity-20">
          <GripHorizontal className="w-4 h-4" />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-5">
          {/* Calculated Stats (Turf) */}
          {stats && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <TrendingUp className="w-3.5 h-3.5 text-green-500" />
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/70">Geometry Stats</h4>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {stats.map((stat, i) => (
                  <div key={i} className="p-3 rounded-xl bg-green-500/5 border border-green-500/10 flex flex-col gap-1">
                    <span className="text-[9px] font-black uppercase tracking-widest text-green-600/70">{stat.label}</span>
                    <span className="text-xs font-black tabular-nums">{stat.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Properties Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/70">Attributes</h4>
              <div className="flex gap-1">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  title="Add new attribute"
                  className={cn("h-6 w-6 rounded-md transition-colors", isAddingProp ? "bg-primary text-white" : "hover:bg-primary/10")} 
                  onClick={() => setIsAddingProp(!isAddingProp)}
                >
                  <Plus className="w-3 h-3" />
                </Button>
                <Button variant="ghost" size="icon" title="Copy all attributes" className="h-6 w-6 rounded-md hover:bg-primary/10" onClick={handleCopyProperties}>
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <AnimatePresence>
                {isAddingProp && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-2 rounded-xl bg-primary/5 border border-primary/20 flex gap-2 mb-2">
                      <input 
                        autoFocus
                        placeholder="Key (e.g. city)"
                        className="bg-transparent border-none p-0 text-xs font-bold focus:ring-0 w-full"
                        value={newPropKey}
                        onChange={(e) => setNewPropKey(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddProperty()}
                      />
                      <Button size="sm" className="h-7 px-3 rounded-lg" onClick={handleAddProperty}>Add</Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              
              {Object.entries(properties).length > 0 ? (
                Object.entries(properties).map(([key, value]) => (
                  <div 
                    key={key} 
                    className="group/row flex flex-col gap-1 p-2.5 rounded-xl bg-accent/20 border border-transparent hover:border-primary/20 hover:bg-accent/40 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground group-hover/row:text-primary/70 transition-colors">
                        {key}
                      </span>
                      <button 
                        onClick={() => handleRemoveProperty(key)}
                        title={`Remove ${key}`}
                        className="opacity-0 group-hover/row:opacity-100 p-0.5 hover:text-destructive transition-all"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    </div>
                    <input 
                      title={`Edit value for ${key}`}
                      className="bg-transparent border-none p-0 text-xs font-semibold focus:ring-0 w-full text-foreground truncate selection:bg-primary/30"
                      value={typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      onChange={(e) => handleUpdateProperty(key, e.target.value)}
                    />
                  </div>
                ))
              ) : (
                <div className="py-8 text-center flex flex-col items-center gap-2 bg-accent/5 rounded-2xl border border-dashed border-border/50">
                  <Activity className="w-6 h-6 text-muted-foreground/20" />
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">No Custom Attributes</p>
                </div>
              )}
            </div>
          </div>

          {/* Geometry Info */}
          {feature.geometry.type === 'Point' && (
            <div className="space-y-2">
               <div className="flex items-center gap-2 px-1">
                 <MapPin className="w-3 h-3 text-primary" />
                 <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/70">Location</h4>
               </div>
               <div className="p-3 rounded-xl bg-primary/5 border border-primary/10 font-mono text-xs flex items-center justify-between">
                  <span>{(feature.geometry as import('geojson').Point).coordinates[1].toFixed(6)}, {(feature.geometry as import('geojson').Point).coordinates[0].toFixed(6)}</span>
                  <button 
                    onClick={() => {
                      const coords = (feature.geometry as import('geojson').Point).coordinates;
                      navigator.clipboard.writeText(`${coords[1]}, ${coords[0]}`);
                      toast.success('Coordinates copied');
                    }}
                    title="Copy coordinates"
                    className="p-1 hover:bg-primary/10 rounded"
                  >
                    <Copy className="w-3 h-3 text-primary" />
                  </button>
               </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border bg-muted/10 flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 rounded-xl text-[10px] font-bold uppercase tracking-wider h-9"
            onClick={handleRemoveFeature}
          >
            <Trash2 className="w-3 h-3 mr-2" />
            Delete
          </Button>
          <Button 
            variant="default" 
            size="sm" 
            className="flex-1 rounded-xl text-[10px] font-bold uppercase tracking-wider h-9 shadow-lg"
            onClick={() => {
              // Zoom to feature logic
              toast.info('Feature focused');
            }}
          >
            <Maximize2 className="w-3 h-3 mr-2" />
            Focus
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
