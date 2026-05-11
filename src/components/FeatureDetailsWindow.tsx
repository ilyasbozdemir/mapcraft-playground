"use client";

import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { X, GripHorizontal, MapPin, Hash, Maximize2, Copy, Trash2, Box, Activity } from 'lucide-react';
import { Button } from './ui/button';
import { useMapStore } from '@/hooks/useMapStore';
import { toast } from 'sonner';

export function FeatureDetailsWindow() {
  const { selectedFeature, layers, setSelectedFeature, updateLayer } = useMapStore();
  const constraintsRef = useRef(null);

  if (!selectedFeature) return null;

  const layer = layers.find((l): l is import('@/types/geo').MapLayer => l.id === selectedFeature.layerId);
  if (!layer) return null;

  const feature = layer.data.features.find((f, i) => 
    (f.id !== undefined ? f.id === selectedFeature.featureId : i.toString() === selectedFeature.featureId.toString())
  );

  if (!feature) return null;

  const properties = feature.properties || {};

  const handleCopyProperties = () => {
    navigator.clipboard.writeText(JSON.stringify(properties, null, 2));
    toast.success('Properties copied to clipboard');
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
      className="absolute inset-0 z-[1001] pointer-events-none" 
      ref={constraintsRef}
    >
      <motion.div
        drag
        dragMomentum={false}
        dragConstraints={constraintsRef}
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="pointer-events-auto absolute top-24 right-6 w-80 bg-background/90 backdrop-blur-xl border border-border rounded-2xl shadow-[0_32px_64px_-12px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col max-h-[70vh]"
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
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 rounded-xl bg-accent/30 border border-border/50">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
                <Hash className="w-3 h-3" />
                ID
              </div>
              <p className="text-xs font-mono font-bold truncate">
                {String(selectedFeature.featureId).substring(0, 12)}...
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-accent/30 border border-border/50">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
                <Activity className="w-3 h-3" />
                Layer
              </div>
              <p className="text-xs font-bold truncate">{layer.name}</p>
            </div>
          </div>

          {/* Properties Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/70">Attributes</h4>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md hover:bg-primary/10" onClick={handleCopyProperties}>
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            </div>
            
            <div className="space-y-1">
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
                    </div>
                    <input 
                      title={`Edit value for ${key}`}
                      className="bg-transparent border-none p-0 text-xs font-semibold focus:ring-0 w-full text-foreground truncate selection:bg-primary/30"
                      value={typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        const newProps = { ...properties, [key]: newValue };
                        const newData = {
                          ...layer.data,
                          features: layer.data.features.map((f, i) => 
                            (f.id !== undefined ? f.id === selectedFeature.featureId : i.toString() === selectedFeature.featureId.toString())
                              ? { ...f, properties: newProps }
                              : f
                          )
                        };
                        updateLayer(layer.id, { data: newData });
                      }}
                    />
                  </div>
                ))
              ) : (
                <div className="py-12 text-center flex flex-col items-center gap-2 bg-accent/10 rounded-2xl border border-dashed border-border">
                  <Activity className="w-8 h-8 text-muted-foreground/20" />
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">No Attributes</p>
                </div>
              )}
            </div>
          </div>

          {/* Geometry Info */}
          {feature.geometry.type === 'Point' && (
            <div className="space-y-2">
               <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Coordinates</h4>
               <div className="p-3 rounded-xl bg-primary/5 border border-primary/10 font-mono text-xs flex items-center justify-between">
                  <span>{(feature.geometry as import('geojson').Point).coordinates[1].toFixed(6)}, {(feature.geometry as import('geojson').Point).coordinates[0].toFixed(6)}</span>
                  <MapPin className="w-3 h-3 text-primary" />
               </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3 border-t border-border bg-muted/10 flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 rounded-xl text-[10px] font-bold uppercase tracking-wider h-8"
            onClick={handleRemoveFeature}
          >
            <Trash2 className="w-3 h-3 mr-2" />
            Delete
          </Button>
          <Button 
            variant="default" 
            size="sm" 
            className="flex-1 rounded-xl text-[10px] font-bold uppercase tracking-wider h-8"
            onClick={() => {
              // Zoom to feature logic would go here
              toast.info('Zoom to feature not implemented yet');
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
