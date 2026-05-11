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

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { FeatureDetailsWindow } from '@/components/FeatureDetailsWindow';
import { Layers } from 'lucide-react';

export default function Home() {
  const { layers, baseLayer, setBaseLayer, addLayer, customBaseUrl, setCustomBaseUrl } = useMapStore();

  const BASE_LAYER_OPTIONS = [
    { id: 'osm', label: 'Standard', icon: Globe },
    { id: 'satellite', label: 'Satellite', icon: Sun },
    { id: 'dark', label: 'Dark Mode', icon: Moon },
    { id: 'topo', label: 'Topographic', icon: MapIcon },
    { id: 'terrain', label: 'Terrain', icon: Navigation2 },
    { id: 'custom', label: 'Custom Tiles', icon: Plus },
  ];

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
                <SheetTrigger render={
                  <Button variant="secondary" size="icon" className="bg-background/80 backdrop-blur-md border border-border rounded-xl shadow-2xl h-9 w-9">
                    <Menu className="w-4 h-4" />
                  </Button>
                } />
                <SheetContent side="left" className="p-0 w-[300px] sm:w-[320px] border-r-0">
                  <LayerPanel />
                </SheetContent>
              </Sheet>
            </div>

            <div className="bg-background/80 backdrop-blur-md border border-border rounded-xl px-3 md:px-4 py-1.5 md:py-2 shadow-2xl flex items-center gap-2 md:gap-3">
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-primary flex items-center justify-center">
                <MapIcon className="w-4 h-4 md:w-5 md:h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xs md:text-sm font-bold tracking-tight">MapCraft</h1>
                <p className="text-[9px] md:text-[10px] text-muted-foreground font-medium uppercase tracking-widest leading-none">Pro Engine</p>
              </div>
            </div>
            
            {/* Base Layer Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger render={
                <Button variant="secondary" className="bg-background/80 backdrop-blur-md border border-border rounded-xl px-3 h-9 md:h-10 shadow-2xl flex items-center gap-2">
                  <Layers className="w-4 h-4 text-primary" />
                  <span className="text-xs font-bold hidden sm:inline">
                    {BASE_LAYER_OPTIONS.find(l => l.id === baseLayer)?.label}
                  </span>
                </Button>
              } />
              <DropdownMenuContent className="w-56 rounded-2xl p-2 bg-background/95 backdrop-blur-xl border-border shadow-2xl">
                <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2 py-1.5">Map Style</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {BASE_LAYER_OPTIONS.map((layer) => (
                  <DropdownMenuItem
                    key={layer.id}
                    className={cn(
                      "rounded-xl px-2 py-2 cursor-pointer mb-0.5",
                      baseLayer === layer.id ? "bg-primary/10 text-primary font-bold" : "hover:bg-accent"
                    )}
                    onClick={() => setBaseLayer(layer.id as BaseLayerType)}
                  >
                    <layer.icon className={cn("w-4 h-4 mr-3", baseLayer === layer.id ? "text-primary" : "text-muted-foreground")} />
                    <span className="text-sm">{layer.label}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {baseLayer === 'custom' && (
              <div className="hidden sm:flex bg-background/80 backdrop-blur-md border border-border rounded-xl p-1 shadow-2xl items-center gap-1 pointer-events-auto animate-in slide-in-from-left-2 fade-in">
                <input 
                  type="text" 
                  placeholder="Tiles URL: https://{s}.tile.osm.org/{z}/{x}/{y}.png"
                  className="bg-transparent border-none focus:ring-0 text-[10px] px-3 w-48 md:w-64 font-mono font-medium"
                  value={customBaseUrl}
                  onChange={(e) => setCustomBaseUrl(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 md:gap-2 pointer-events-auto shrink-0">
            {/* Removed load sample and other icons as requested */}
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-black uppercase tracking-widest text-primary leading-none">Live</span>
              <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-tighter">Workspace</span>
            </div>
          </div>
        </div>

        <div className="flex-1 w-full h-full relative">
          <MapView />
          <MapToolbar />
          <AttributeTable />
          <FeatureDetailsWindow />
        </div>

        {layers.length === 0 && (
          <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none p-4 md:p-6 overflow-y-auto custom-scrollbar">
            <div className="max-w-xl w-full pointer-events-auto my-auto animate-in zoom-in-95 duration-500">
              <div className="bg-background/90 backdrop-blur-xl border border-border rounded-[2.5rem] p-8 md:p-12 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.2)] text-center relative overflow-hidden">
                {/* Decorative background glow */}
                <div className="absolute -top-24 -left-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl" />
                <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl" />
                
                <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-8 rotate-3 hover:rotate-0 transition-transform duration-500 relative z-10">
                  <MapIcon className="w-10 h-10 text-primary" />
                </div>
                <h2 className="text-2xl md:text-3xl lg:text-4xl font-black tracking-tight mb-4 bg-linear-to-br from-foreground to-foreground/60 bg-clip-text text-transparent italic relative z-10">
                  Craft Your World
                </h2>
                <p className="text-muted-foreground mb-8 md:mb-10 text-sm md:text-base lg:text-lg font-medium max-w-sm mx-auto leading-relaxed px-4 md:px-0 relative z-10">
                  Start by uploading spatial data or use the drawing tools to create new geometries.
                </p>
                <div className="relative z-10">
                  <FileUploader className="bg-background/50 backdrop-blur-sm shadow-2xl border-primary/20" />
                </div>
                
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
