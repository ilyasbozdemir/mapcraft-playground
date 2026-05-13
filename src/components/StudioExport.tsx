"use client";

import React, { useState } from 'react';
import { 
  Download, 
  FileJson, 
  FileCode, 
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Copy,
  LayoutTemplate
} from 'lucide-react';
import { useMapStore } from '@/hooks/useMapStore';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatSize } from '@/lib/geoUtils';

export function StudioExport() {
  const { layers, groups, baseLayer, customBaseUrl } = useMapStore();
  const [selectedFormat, setSelectedFormat] = useState<'geojson' | 'mapcraft' | 'json'>('geojson');
  
  const totalFeatures = layers.reduce((acc, l) => acc + l.featureCount, 0);
  const totalSize = layers.reduce((acc, l) => acc + l.size, 0);

  const exportData = () => {
    let content = "";
    let filename = "";

    if (selectedFormat === 'geojson') {
      const collection = {
        type: 'FeatureCollection',
        features: layers.flatMap(l => l.data.features.map(f => ({
          ...f,
          properties: {
            ...f.properties,
            layerName: l.name,
            layerColor: l.color
          }
        })))
      };
      content = JSON.stringify(collection, null, 2);
      filename = `export-${new Date().getTime()}.geojson`;
    } else if (selectedFormat === 'mapcraft') {
      const project = {
        version: "1.0",
        timestamp: Date.now(),
        layers,
        groups,
        baseLayer,
        customBaseUrl
      };
      content = JSON.stringify(project, null, 2);
      filename = `project-${new Date().getTime()}.mapcraft`;
    } else {
      content = JSON.stringify(layers, null, 2);
      filename = `layers-${new Date().getTime()}.json`;
    }

    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success(`Exported as ${selectedFormat.toUpperCase()}`);
  };

  return (
    <Dialog>
      <DialogTrigger 
        render={
          <Button 
            variant="default" 
            size="sm" 
            className="w-full text-[10px] h-10 font-black uppercase tracking-widest rounded-xl shadow-[0_10px_20px_rgba(var(--primary),0.2)] hover:shadow-primary/40 transition-all duration-300 bg-primary hover:scale-[1.02]"
            disabled={layers.length === 0}
          />
        }
      >
        <LayoutTemplate className="w-4 h-4 mr-2" />
        Open Export Studio
      </DialogTrigger>
      <DialogContent className="max-w-3xl h-[80vh] flex flex-col p-0 border-none bg-background/60 backdrop-blur-3xl overflow-hidden rounded-[2rem] shadow-[0_50px_100px_rgba(0,0,0,0.5)]">
        <div className="absolute inset-0 bg-linear-to-br from-primary/5 via-transparent to-primary/5 pointer-events-none" />
        
        <DialogHeader className="p-8 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20 rotate-3">
                <Download className="w-6 h-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-black uppercase tracking-tighter italic">MapCraft Studio</DialogTitle>
                <DialogDescription className="text-xs font-bold text-primary/60 uppercase tracking-widest">Advanced Export Engine • V1.0</DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="h-6 rounded-full border-primary/20 text-primary bg-primary/5 px-3">
                <ShieldCheck className="w-3 h-3 mr-1" /> Ready for Export
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-[1fr_300px] gap-0">
          {/* Left Side - Config */}
          <div className="p-8 pt-4 space-y-8 overflow-y-auto">
            <section>
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-4">1. Choose Format</h3>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { id: 'geojson', name: 'GeoJSON', desc: 'Standard spatial data', icon: FileJson },
                  { id: 'mapcraft', name: 'MapCraft', desc: 'Full project bundle', icon: LayoutTemplate },
                  { id: 'json', name: 'Raw JSON', desc: 'Layers metadata', icon: FileCode },
                ].map((format) => (
                  <button
                    key={format.id}
                    onClick={() => setSelectedFormat(format.id as 'geojson' | 'mapcraft' | 'json')}
                    className={cn(
                      "p-5 rounded-2xl border-2 text-left transition-all duration-300 relative overflow-hidden group",
                      selectedFormat === format.id 
                        ? "border-primary bg-primary/5 shadow-xl" 
                        : "border-border/50 hover:border-primary/30 hover:bg-accent/30"
                    )}
                  >
                    <format.icon className={cn("w-8 h-8 mb-4 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6", selectedFormat === format.id ? "text-primary" : "text-muted-foreground")} />
                    <h4 className="font-black text-xs uppercase mb-1">{format.name}</h4>
                    <p className="text-[10px] text-muted-foreground font-medium">{format.desc}</p>
                    {selectedFormat === format.id && (
                      <div className="absolute top-3 right-3">
                        <CheckCircle2 className="w-4 h-4 text-primary" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-4">2. Layer Manifest</h3>
              <div className="space-y-3">
                {layers.map(layer => (
                  <div key={layer.id} className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-accent/10">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-2 h-8 rounded-full" style={{ backgroundColor: layer.color }} />
                      <div className="min-w-0">
                        <p className="font-bold text-xs truncate">{layer.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="secondary" className="text-[8px] font-black px-1.5 py-0 rounded leading-none uppercase">{layer.geometryType}</Badge>
                          <span className="text-[10px] text-muted-foreground font-medium">{layer.featureCount} features • {formatSize(layer.size)}</span>
                        </div>
                      </div>
                    </div>
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Right Side - Summary & Actions */}
          <div className="bg-accent/20 p-8 flex flex-col justify-between border-l border-border/50 relative">
             <div className="space-y-6">
                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-4">Summary</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-end border-b border-border/50 pb-2">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">Total Features</span>
                      <span className="text-xl font-black">{totalFeatures}</span>
                    </div>
                    <div className="flex justify-between items-end border-b border-border/50 pb-2">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">Data Size</span>
                      <span className="text-xl font-black">{formatSize(totalSize)}</span>
                    </div>
                    <div className="flex justify-between items-end border-b border-border/50 pb-2">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">Base Engine</span>
                      <span className="text-xl font-black uppercase">{baseLayer}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
                  <div className="flex gap-2 text-primary">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <p className="text-[10px] font-medium leading-relaxed uppercase tracking-tight">
                      Exporting will package all visible and hidden layers into the selected manifest format.
                    </p>
                  </div>
                </div>
             </div>

             <div className="space-y-3">
               <Button 
                variant="outline" 
                className="w-full h-12 rounded-2xl font-black uppercase tracking-widest text-[10px]"
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(layers));
                  toast.success('Project payload copied');
                }}
               >
                 <Copy className="w-4 h-4 mr-2" />
                 Copy Payload
               </Button>
               <Button 
                className="w-full h-14 rounded-2xl font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-primary/20 active:scale-95 transition-all"
                onClick={exportData}
               >
                 <Download className="w-5 h-5 mr-3" />
                 Generate Pack
               </Button>
             </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
