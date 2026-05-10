"use client";

import React from 'react';
import dynamic from 'next/dynamic';
import { 
  Plus, 
  Map as MapIcon, 
  Settings2, 
  Globe,
  Moon,
  Sun
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LayerPanel } from '@/components/LayerPanel';
import { FileUploader } from '@/components/FileUploader';
import { AttributeTable } from '@/components/AttributeTable';
import { useMapStore } from '@/hooks/useMapStore';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';

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

export default function Home() {
  const { layers, baseLayer, setBaseLayer, addLayer } = useMapStore();

  const loadSampleData = async () => {
    try {
      // Small sample GeoJSON (approx coords for Turkey/Istanbul)
      const sampleData = {
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

      const layer: any = {
        id: crypto.randomUUID(),
        name: 'Sample Turkish Cities',
        type: 'geojson',
        data: sampleData,
        visible: true,
        color: '#3b82f6',
        geometryType: 'Mixed',
        featureCount: 3,
        size: JSON.stringify(sampleData).length,
        createdAt: Date.now(),
      };

      addLayer(layer);
      toast.success('Sample data loaded successfully');
    } catch (err) {
      toast.error('Failed to load sample data');
    }
  };

  return (
    <main className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <LayerPanel />

      {/* Main Content Area */}
      <div className="relative flex-1 h-full flex flex-col">
        {/* Top Floating Navbar */}
        <div className="absolute top-6 left-6 right-6 z-1000 flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-3 pointer-events-auto">
            <div className="bg-background/80 backdrop-blur-md border border-border rounded-xl px-4 py-2 shadow-2xl flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <MapIcon className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-tight">MapCraft</h1>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">v1.0.0 Alpha</p>
              </div>
            </div>
            
            <div className="bg-background/80 backdrop-blur-md border border-border rounded-xl p-1 shadow-2xl flex items-center gap-1">
              {[
                { id: 'osm', label: 'Standard', icon: Globe },
                { id: 'satellite', label: 'Satellite', icon: Sun },
                { id: 'dark', label: 'Dark', icon: Moon },
              ].map((layer) => (
                <Tooltip key={layer.id}>
                  <TooltipTrigger asChild>
                    <Button 
                      variant={baseLayer === layer.id ? "default" : "ghost"} 
                      size="sm" 
                      className="h-8 px-3 rounded-lg text-xs font-semibold"
                      onClick={() => setBaseLayer(layer.id as any)}
                    >
                      <layer.icon className="w-3.5 h-3.5 mr-2" />
                      {layer.label}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Switch to {layer.label} layer</TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 pointer-events-auto">
            <Button variant="secondary" size="sm" className="bg-background/80 backdrop-blur-md border border-border rounded-xl shadow-2xl" onClick={loadSampleData}>
              Load Sample
            </Button>
            <Button variant="secondary" size="icon" className="bg-background/80 backdrop-blur-md border border-border rounded-xl shadow-2xl h-9 w-9">
              <Settings2 className="w-4 h-4" />
            </Button>
            <Button variant="secondary" size="icon" className="bg-background/80 backdrop-blur-md border border-border rounded-xl shadow-2xl h-9 w-9">
              <Globe className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Map View */}
        <div className="flex-1 w-full h-full">
          {layers.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center p-6 bg-muted/10">
              <div className="max-w-xl w-full">
                <div className="text-center mb-8">
                  <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-6 ring-1 ring-primary/20">
                    <Plus className="w-10 h-10 text-primary" />
                  </div>
                  <h2 className="text-4xl font-black tracking-tight mb-3 italic">READY TO MAP?</h2>
                  <p className="text-muted-foreground text-lg">
                    Drop your spatial files below to begin your exploration.
                  </p>
                </div>
                <FileUploader className="bg-background/50 backdrop-blur-sm shadow-2xl border-primary/20" />
                
                <div className="mt-12 grid grid-cols-3 gap-6">
                  {[
                    { title: 'GeoJSON', desc: 'Standard JSON spatial data' },
                    { title: 'KML/KMZ', desc: 'Google Earth & Maps' },
                    { title: 'Shapefiles', desc: 'Industry standard ESRI' },
                  ].map((item, i) => (
                    <div key={i} className="p-4 rounded-2xl bg-card border border-border/50 text-center hover:border-primary/50 transition-colors">
                      <h4 className="font-bold text-xs uppercase tracking-widest text-primary mb-1">{item.title}</h4>
                      <p className="text-[10px] text-muted-foreground font-medium">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <MapView />
          )}
        </div>

        {/* Feature Tools / Bottom Panel */}
        <AttributeTable />
        
        {/* Dropzone overlay when map is loaded */}
        {layers.length > 0 && (
          <div className="fixed bottom-6 right-6 z-1000">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="relative group">
                  <div className="absolute -inset-1 bg-linear-to-r from-primary to-blue-600 rounded-full blur opacity-40 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
                  <Button 
                    size="icon" 
                    className="relative h-12 w-12 rounded-full shadow-2xl border-2 border-background"
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.multiple = true;
                      input.onchange = (e) => {
                        // FileUploader will handle via the store's addLayer if I expose it or use a ref
                        // For simplicity, I'll just trigger a hidden upload
                        const files = (e.target as HTMLInputElement).files;
                        if (files) {
                          // Manually trigger the drop logic if needed, but for now I'll just add a "Add Layer" button in the sidebar
                        }
                      };
                    }}
                  >
                    <Plus className="w-6 h-6" />
                  </Button>
                </div>
              </TooltipTrigger>
              <TooltipContent side="left">Add new layer</TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
    </main>
  );
}
