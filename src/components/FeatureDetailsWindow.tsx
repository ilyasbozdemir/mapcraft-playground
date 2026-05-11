"use client";

import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { X, GripHorizontal, MapPin, Hash, Maximize2, Copy, Trash2, Box, Activity } from 'lucide-react';
import { Button } from './ui/button';
import { useMapStore } from '@/hooks/useMapStore';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function FeatureDetailsWindow() {
  const { selectedFeature, layers, setSelectedFeature, removeLayer, updateLayer } = useMapStore();
  const constraintsRef = useRef(null);

  if (!selectedFeature) return null;

  const layer = layers.find(l => l.id === selectedFeature.layerId);
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
    // This is a bit complex as we need to update the layer's GeoJSON data
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

          {/* Properties Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Properties</h4>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopyProperties}>
                <Copy className="w-3 h-3" />
              </Button>
            </div>
            
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-left border-collapse">
                <tbody>
                  {Object.entries(properties).length > 0 ? (
                    Object.entries(properties).map(([key, value]) => (
                      <tr key={key} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="py-2 px-3 text-muted-foreground font-bold text-[10px] uppercase tracking-wider w-1/3 border-r border-border/50">
                          {key}
                        </td>
                        <td className="py-2 px-3 text-foreground font-mono text-[11px] break-all">
                          {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={2} className="py-8 text-center text-muted-foreground italic text-xs">
                        No properties found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Geometry Info */}
          {feature.geometry.type === 'Point' && (
            <div className="space-y-2">
               <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Coordinates</h4>
               <div className="p-3 rounded-xl bg-primary/5 border border-primary/10 font-mono text-xs flex items-center justify-between">
                  <span>{(feature.geometry as any).coordinates[1].toFixed(6)}, {(feature.geometry as any).coordinates[0].toFixed(6)}</span>
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
