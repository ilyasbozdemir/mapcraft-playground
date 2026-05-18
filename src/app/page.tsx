"use client";

import React from 'react';
import dynamic from 'next/dynamic';
import { 
  Plus, 
  Map as MapIcon, 
  Globe,
  Moon,
  Sun,
  Navigation2,
  Menu,
  Layers
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LayerPanel } from '@/components/LayerPanel';
import { FileUploader } from '@/components/FileUploader';
import { useMapStore } from '@/hooks/useMapStore';
import { BaseLayerType } from '@/types/geo';
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

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import { FeatureDetailsWindow } from '@/components/FeatureDetailsWindow';

export default function Home() {
  const { layers, baseLayer, setBaseLayer, customBaseUrl, setCustomBaseUrl } = useMapStore();

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

            <div className="flex items-center gap-3 bg-background/80 backdrop-blur-md border border-border/50 rounded-2xl px-4 py-2 shadow-2xl ring-1 ring-white/10">
              <div className="w-10 h-10 rounded-xl bg-linear-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg transform -rotate-3 hover:rotate-0 transition-transform duration-300">
                <MapIcon className="w-6 h-6 text-primary-foreground" />
              </div>
              <div className="flex flex-col">
                <h1 className="text-sm font-black tracking-tighter leading-none bg-linear-to-br from-foreground to-foreground/70 bg-clip-text text-transparent italic">
                  MAPCRAFT <span className="text-primary font-mono not-italic">LAB</span>
                </h1>
                <div className="flex items-center gap-1.5 mt-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  <p className="text-[9px] text-muted-foreground font-black uppercase tracking-[0.2em] leading-none">Pro Engine v1.2</p>
                </div>
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
                <DropdownMenuGroup>
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
                </DropdownMenuGroup>
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
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-black uppercase tracking-widest text-primary leading-none">Live</span>
              <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-tighter">Workspace</span>
            </div>
          </div>
        </div>

        <div className="flex-1 w-full h-full relative">
          <MapView />
          <MapToolbar />
          <FeatureDetailsWindow />
        </div>


      </div>
    </main>
  );
}
