"use client";

import React from 'react';
import { 
  Square, 
  MousePointer2, 
  MapPin, 
  X,
  Navigation2,
  Ruler,
  Maximize,
  Group
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMapStore } from '@/hooks/useMapStore';
import { DrawingMode } from '@/types/geo';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export function MapToolbar() {
  const { drawingMode, setDrawingMode } = useMapStore();

  const tools: { id: DrawingMode; icon: React.ElementType; label: string; shortcut: string }[] = [
    { id: 'none', icon: MousePointer2, label: 'Select', shortcut: 'V' },
    { id: 'polygon', icon: Square, label: 'Draw Polygon', shortcut: 'P' },
    { id: 'line', icon: Navigation2, label: 'Draw Line', shortcut: 'L' },
    { id: 'point', icon: MapPin, label: 'Add Point', shortcut: 'A' },
    { id: 'measure-distance', icon: Ruler, label: 'Measure Distance', shortcut: 'M' },
    { id: 'measure-area', icon: Maximize, label: 'Measure Area', shortcut: 'S' },
    { id: 'select-points', icon: Group, label: 'Points to Polygon', shortcut: 'G' },
  ];

  return (
    <div className="absolute top-20 md:top-24 left-4 md:left-6 z-1000 flex flex-col gap-2">
      <div className="bg-background/80 backdrop-blur-md border border-border rounded-xl p-1 md:p-1.5 shadow-2xl flex flex-col gap-1 pointer-events-auto">
        {tools.map((tool) => (
          <Tooltip key={tool.id}>
            <TooltipTrigger
              render={
                <Button
                  variant={drawingMode === tool.id ? 'default' : 'ghost'}
                  size="icon"
                  className={cn(
                    "h-8 w-8 md:h-10 md:w-10 rounded-lg transition-all duration-200",
                    drawingMode === tool.id 
                      ? "bg-primary text-primary-foreground shadow-lg scale-105" 
                      : "hover:bg-accent text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setDrawingMode(tool.id)}
                >
                  <tool.icon className="w-4 h-4 md:w-5 md:h-5" />
                </Button>
              }
            />
            <TooltipContent side="right" className="flex items-center gap-2">
              <span className="font-medium">{tool.label}</span>
              <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                {tool.shortcut}
              </kbd>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>

      {drawingMode !== 'none' && (
        <div className="bg-background/80 backdrop-blur-md border border-border rounded-xl p-1 md:p-1.5 shadow-2xl flex flex-col gap-1 animate-in slide-in-from-left-2 fade-in pointer-events-auto">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 md:h-10 md:w-10 rounded-lg text-destructive hover:bg-destructive/10"
                  onClick={() => setDrawingMode('none')}
                >
                  <X className="w-4 h-4 md:w-5 md:h-5" />
                </Button>
              }
            />
            <TooltipContent side="right">Cancel Drawing</TooltipContent>
          </Tooltip>
        </div>
      )}
    </div>
  );
}
