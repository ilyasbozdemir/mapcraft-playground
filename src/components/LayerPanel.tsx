"use client";

import React from 'react';
import { 
  Eye, 
  EyeOff, 
  Trash2, 
  Layers, 
  Info, 
  MoreVertical, 
  Share2, 
  Download,
  Palette
} from 'lucide-react';
import { useMapStore } from '@/hooks/useMapStore';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatSize } from '@/lib/geoUtils';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function LayerPanel() {
  const { 
    layers, 
    removeLayer, 
    toggleLayerVisibility, 
    updateLayerColor, 
    selectedLayerId, 
    setSelectedLayerId 
  } = useMapStore();

  const exportLayer = (layerId: string) => {
    const layer = layers.find(l => l.id === layerId);
    if (!layer) return;

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(layer.data));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `${layer.name}.geojson`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    toast.success(`Exported ${layer.name} as GeoJSON`);
  };

  return (
    <div className="flex flex-col h-full bg-card border-r border-border w-[320px]">
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-primary" />
          <h2 className="font-bold text-lg">Layers</h2>
        </div>
        <Badge variant="secondary" className="font-mono">
          {layers.length}
        </Badge>
      </div>
      
      <Separator />

      <ScrollArea className="flex-1">
        {layers.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground h-40">
            <Info className="w-8 h-8 mb-2 opacity-20" />
            <p className="text-sm">No layers loaded yet.</p>
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {layers.map((layer) => (
              <div 
                key={layer.id}
                className={cn(
                  "group relative p-3 rounded-lg border transition-all duration-200 cursor-pointer",
                  selectedLayerId === layer.id 
                    ? "border-primary bg-primary/5 ring-1 ring-primary/20" 
                    : "border-border hover:border-primary/50 hover:bg-accent/50"
                )}
                onClick={() => setSelectedLayerId(layer.id)}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex flex-col min-w-0 flex-1">
                    <input
                      className="font-medium text-sm truncate pr-6 bg-transparent border-none focus:ring-1 focus:ring-primary rounded px-1 -ml-1 w-full outline-none"
                      value={layer.name}
                      onChange={(e) => {
                        const newName = e.target.value;
                        useMapStore.setState(state => ({
                          layers: state.layers.map(l => l.id === layer.id ? { ...l, name: newName } : l)
                        }));
                      }}
                      onClick={(e) => e.stopPropagation()}
                      title="Click to rename"
                    />
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-background">
                        {layer.type.toUpperCase()}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {layer.featureCount} features • {formatSize(layer.size)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 shrink-0">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7" 
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleLayerVisibility(layer.id);
                      }}
                    >
                      {layer.visible ? (
                        <Eye className="w-4 h-4 text-primary" />
                      ) : (
                        <EyeOff className="w-4 h-4 text-muted-foreground" />
                      )}
                    </Button>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onClick={() => exportLayer(layer.id)}>
                          <Download className="w-4 h-4 mr-2" />
                          Export GeoJSON
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => removeLayer(layer.id)} className="text-destructive">
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 flex-1">
                    <div 
                      className="w-3 h-3 rounded-full border border-white/20" 
                      style={{ backgroundColor: layer.color }}
                    />
                    <input 
                      type="color" 
                      value={layer.color} 
                      onChange={(e) => updateLayerColor(layer.id, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-0 h-0 invisible absolute"
                      id={`color-${layer.id}`}
                    />
                    <label 
                      htmlFor={`color-${layer.id}`}
                      className="text-[10px] text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1 transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Palette className="w-3 h-3" />
                      Adjust color
                    </label>
                  </div>
                  
                  <span className="text-[10px] font-mono text-muted-foreground opacity-50 uppercase">
                    {layer.geometryType}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
      
      <div className="p-4 bg-muted/30 border-t border-border">
        <div className="flex items-center gap-2 mb-3">
          <Share2 className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wider">Export View</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" className="text-[10px] h-8" disabled={layers.length === 0}>
            Copy All
          </Button>
          <Button variant="outline" size="sm" className="text-[10px] h-8" disabled={layers.length === 0}>
            Export All
          </Button>
        </div>
      </div>
    </div>
  );
}
