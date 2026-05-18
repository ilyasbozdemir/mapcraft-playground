"use client";

import React from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Database, ChevronUp, Maximize2 } from 'lucide-react';
import { useMapStore } from '@/hooks/useMapStore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

export function AttributeTable() {
  const { layers, selectedLayerId, setSelectedFeature } = useMapStore();
  const selectedLayer = layers.find(l => l.id === selectedLayerId);
  const [limit, setLimit] = React.useState(100);

  if (!selectedLayer) return null;

  const properties = selectedLayer.data.features[0]?.properties || {};
  const columns = Object.keys(properties);

  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button 
          variant="secondary" 
          className="fixed bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 z-1000 shadow-2xl gap-2 rounded-full px-4 md:px-6 h-10 md:h-11 border border-primary/20 hover:border-primary/50 transition-all group pointer-events-auto"
        >
          <Database className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
          <span className="hidden sm:inline font-semibold text-xs uppercase tracking-widest">Attribute Table</span>
          <span className="sm:hidden font-semibold text-xs uppercase tracking-widest">Data</span>
          <Badge variant="secondary" className="ml-0.5 md:ml-1 px-1 h-4 min-w-5 text-[10px] bg-primary/10 text-primary border-0">
            {selectedLayer.featureCount}
          </Badge>
          <ChevronUp className="w-4 h-4 ml-0.5 md:ml-1 opacity-50" />
        </Button>
      </DrawerTrigger>
      <DrawerContent className="h-[70vh] px-4 pb-4">
        <div className="mx-auto w-full max-w-7xl h-full flex flex-col">
          <DrawerHeader className="px-0 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Database className="w-5 h-5 text-primary" />
              </div>
              <div>
                <DrawerTitle className="text-xl font-bold flex items-center gap-2">
                  {selectedLayer.name}
                  <Badge variant="outline" className="text-[10px] uppercase font-mono tracking-widest">
                    {selectedLayer.geometryType}
                  </Badge>
                </DrawerTitle>
                <p className="text-sm text-muted-foreground">
                  Displaying {Math.min(limit, selectedLayer.featureCount)} of {selectedLayer.featureCount} records (Infinite Scroll active).
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-2">
                <Maximize2 className="w-4 h-4" />
                Fullscreen
              </Button>
            </div>
          </DrawerHeader>

          <div className="flex-1 overflow-hidden border rounded-xl bg-card/50">
            <ScrollArea 
              key={selectedLayerId}
              className="h-full"
              onScrollCapture={(e) => {
                const target = e.target as HTMLDivElement;
                if (target.scrollHeight - target.scrollTop - target.clientHeight < 100) {
                  if (limit < selectedLayer.data.features.length) {
                    setLimit(prev => Math.min(prev + 100, selectedLayer.data.features.length));
                  }
                }
              }}
            >
              <Table>
                <TableHeader className="bg-muted/50 sticky top-0 z-10 backdrop-blur-sm">
                  <TableRow>
                    <TableHead className="w-12 text-center text-[10px] font-bold uppercase">#</TableHead>
                    {columns.map((col) => (
                      <TableHead key={col} className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {col}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedLayer.data.features.slice(0, limit).map((feature, idx) => {
                    const featId = feature.id !== undefined ? feature.id : idx.toString();
                    return (
                      <TableRow 
                        key={featId} 
                        onClick={() => setSelectedFeature({ layerId: selectedLayer.id, featureId: featId })}
                        className="hover:bg-primary/5 cursor-pointer group transition-colors"
                      >
                        <TableCell className="text-center font-mono text-[10px] text-muted-foreground">
                          {idx + 1}
                        </TableCell>
                        {columns.map((col) => (
                          <TableCell key={col} className="text-[11px] font-mono group-hover:text-primary transition-colors">
                            {String(feature.properties?.[col] ?? '-')}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {selectedLayer.data.features.length > limit && (
                <div className="text-center py-3 text-[10px] font-mono text-muted-foreground/70 bg-accent/20 animate-pulse flex items-center justify-center gap-1.5 border-t border-border/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping"></span>
                  <span>Scroll down to load more records ({selectedLayer.data.features.length - limit} remaining)...</span>
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
