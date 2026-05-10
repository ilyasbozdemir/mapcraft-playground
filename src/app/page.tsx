"use client";

import React from 'react';
import dynamic from 'next/dynamic';
import { 
  Plus, 
  Map as MapIcon, 
  Settings2, 
  Globe,
  Moon,
  Sun,
  Navigation2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LayerPanel } from '@/components/LayerPanel';
import { FileUploader } from '@/components/FileUploader';
import { AttributeTable } from '@/components/AttributeTable';
import { useMapStore } from '@/hooks/useMapStore';
import { MapLayer, BaseLayerType } from '@/types/geo';
import { FeatureCollection } from 'geojson';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { MapToolbar } from '@/components/MapToolbar';

// Dynamic import for Leaflet (client-side only)
const MapView = dynamic(() => import('@/components/MapView'), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-accent/20 animate-pulse">
      <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
      <span className="text-lg font-medium text-muted-foreground tracking-widest uppercase">Initializing Map Engine</span>
    </div>
  )
});

import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Menu } from 'lucide-react';

export default function Home() {
  const { layers, baseLayer, setBaseLayer, addLayer, customBaseUrl, setCustomBaseUrl } = useMapStore();

  const loadSampleData = async () => {
    try {
      const sampleData: FeatureCollection = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { name: 'Istanbul', population: '15.8M', area: '5,343 km²' },
            geometry: { type: 'Point', coordinates: [28.9784, 41.0082] }
          },
          {
            type: 'Feature',
            properties: { name: 'Ankara', population: '5.7M', area: '25,632 km²' },
            geometry: { type: 'Point', coordinates: [32.8597, 39.9334] }
          },
          {
            type: 'Feature',
            properties: { name: 'Marmara Sea Area', region: 'Marmara' },
            geometry: {
              type: 'Polygon',
              coordinates: [[[27.5, 40.5], [29.5, 40.5], [29.5, 41.2], [27.5, 41.2], [27.5, 40.5]]]
            }
          }
        ]
      };

      const layer: MapLayer = {
        id: crypto.randomUUID(),
        name: 'Sample Turkish Cities',
        type: 'geojson' as const,
        data: sampleData,
        visible: true,
        color: '#3b82f6',
        geometryType: 'Mixed' as const,
        featureCount: 3,
        size: JSON.stringify(sampleData).length,
        createdAt: Date.now(),
      };

      addLayer(layer);
      toast.success('Sample data loaded successfully');
    } catch (err) {
      console.error(err);
      toast.error('Failed to load sample data');
    }
  };

  return (
    <main className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <LayerPanel />
      </div>

      {/* Main Content Area */}
      <div className="relative flex-1 h-full flex flex-col overflow-hidden">
        {/* Top Floating Navbar */}
        <div className="absolute top-4 md:top-6 left-4 md:left-6 right-4 md:right-6 z-1000 flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-2 md:gap-3 pointer-events-auto">
            {/* Mobile Sidebar Toggle */}
            <div className="lg:hidden">
              <Sheet>
                <SheetTrigger>
                  <Button variant="secondary" size="icon" className="bg-background/80 backdrop-blur-md border border-border rounded-xl shadow-2xl h-9 w-9">
                    <Menu className="w-4 h-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 w-[300px] sm:w-[320px] border-r-0">
                  <LayerPanel />
                </SheetContent>
              </Sheet>
            </div>

            <div className="bg-background/80 backdrop-blur-md border border-border rounded-xl px-3 md:px-4 py-1.5 md:py-2 shadow-2xl flex items-center gap-2 md:gap-3">
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-primary flex items-center justify-center">
                <MapIcon className="w-4 h-4 md:w-5 md:h-5 text-primary-foreground" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-xs md:text-sm font-bold tracking-tight">MapCraft</h1>
                <p className="text-[9px] md:text-[10px] text-muted-foreground font-medium uppercase tracking-widest leading-none">v1.0.0 Alpha</p>
              </div>
            </div>
            
            <div className="bg-background/80 backdrop-blur-md border border-border rounded-xl p-0.5 md:p-1 shadow-2xl flex items-center gap-0.5 md:gap-1 max-w-[120px] sm:max-w-none overflow-x-auto no-scrollbar">
              {[
                { id: 'osm', label: 'Std', fullLabel: 'Standard', icon: Globe },
                { id: 'satellite', label: 'Sat', fullLabel: 'Satellite', icon: Sun },
                { id: 'dark', label: 'Drk', fullLabel: 'Dark', icon: Moon },
                { id: 'topo', label: 'Topo', fullLabel: 'Topo', icon: MapIcon },
                { id: 'terrain', label: 'Terr', fullLabel: 'Terrain', icon: Navigation2 },
                { id: 'custom', label: 'Cst', fullLabel: 'Custom', icon: Plus },
              ].map((layer) => (
                <Tooltip key={layer.id}>
                  <TooltipTrigger>
                    <div
                      className={cn(
                        "h-7 md:h-8 px-2 md:px-3 rounded-lg text-[10px] md:text-xs font-semibold flex items-center cursor-pointer transition-colors whitespace-nowrap",
                        baseLayer === layer.id ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                      )}
                      onClick={() => setBaseLayer(layer.id as BaseLayerType)}
                    >
                      <layer.icon className="w-3 md:w-3.5 h-3 md:h-3.5 mr-1 md:mr-2 shrink-0" />
                      <span className="hidden lg:inline">{layer.fullLabel}</span>
                      <span className="lg:hidden">{layer.label}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Switch to {layer.fullLabel} layer</TooltipContent>
                </Tooltip>
              ))}
            </div>

            {baseLayer === 'custom' && (
              <div className="hidden sm:flex bg-background/80 backdrop-blur-md border border-border rounded-xl p-1 shadow-2xl items-center gap-1 pointer-events-auto animate-in slide-in-from-left-2 fade-in">
                <input 
                  type="text" 
                  placeholder="https://{s}.tile.osm.org/{z}/{x}/{y}.png"
                  className="bg-transparent border-none focus:ring-0 text-[10px] px-2 w-32 md:w-48 font-mono"
                  value={customBaseUrl}
                  onChange={(e) => setCustomBaseUrl(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 md:gap-2 pointer-events-auto shrink-0">
            <Button variant="secondary" size="sm" className="hidden sm:flex bg-background/80 backdrop-blur-md border border-border rounded-xl shadow-2xl text-[10px] md:text-xs" onClick={loadSampleData}>
              Load Sample
            </Button>
            <Button variant="secondary" size="icon" className="bg-background/80 backdrop-blur-md border border-border rounded-xl shadow-2xl h-8 w-8 md:h-9 md:w-9">
              <Settings2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </Button>
            <Button variant="secondary" size="icon" className="bg-background/80 backdrop-blur-md border border-border rounded-xl shadow-2xl h-8 w-8 md:h-9 md:w-9">
              <Globe className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 w-full h-full relative">
          <MapView />
          <MapToolbar />
          <AttributeTable />
        </div>

        {layers.length === 0 && (
          <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none p-6">
            <div className="max-w-xl w-full pointer-events-auto">
              <div className="bg-background/90 backdrop-blur-xl border border-border rounded-[2.5rem] p-8 md:p-12 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.2)] text-center">
                <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-8 rotate-3 hover:rotate-0 transition-transform duration-500">
                  <MapIcon className="w-10 h-10 text-primary" />
                </div>
                <h2 className="text-2xl md:text-3xl lg:text-4xl font-black tracking-tight mb-4 bg-linear-to-br from-foreground to-foreground/60 bg-clip-text text-transparent italic">
                  Craft Your World
                </h2>
                <p className="text-muted-foreground mb-8 md:mb-10 text-sm md:text-base lg:text-lg font-medium max-w-sm mx-auto leading-relaxed px-4 md:px-0">
                  Start by uploading spatial data or use the drawing tools to create new geometries.
                </p>
                <FileUploader className="bg-background/50 backdrop-blur-sm shadow-2xl border-primary/20" />
                
                <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 px-4 sm:px-0">
                  {[
                    { title: 'GeoJSON', desc: 'Standard JSON spatial data' },
                    { title: 'KML/KMZ', desc: 'Google Earth & Maps' },
                    { title: 'Shapefiles', desc: 'Industry standard ESRI' },
                  ].map((item, i) => (
                    <div key={i} className="p-4 rounded-2xl bg-card border border-border/50 text-center hover:border-primary/50 transition-all hover:shadow-lg">
                      <h4 className="font-bold text-xs uppercase tracking-widest text-primary mb-1">{item.title}</h4>
                      <p className="text-[10px] text-muted-foreground font-medium">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
