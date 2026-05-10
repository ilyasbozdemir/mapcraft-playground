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
import { Database, ChevronUp, Maximize2, X } from 'lucide-react';
import { useMapStore } from '@/hooks/useMapStore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

export function AttributeTable() {
  const { layers, selectedLayerId } = useMapStore();
  const selectedLayer = layers.find(l => l.id === selectedLayerId);

  if (!selectedLayer) return null;

  const properties = selectedLayer.data.features[0]?.properties || {};
  const columns = Object.keys(properties);

  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button 
          variant="secondary" 
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[500] shadow-2xl gap-2 rounded-full px-6 border border-primary/20 hover:border-primary/50 transition-all group"
        >
          <Database className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
          <span className="font-semibold text-xs uppercase tracking-widest">Attribute Table</span>
          <Badge variant="secondary" className="ml-1 px-1 h-4 min-w-[1.25rem] text-[10px] bg-primary/10 text-primary border-0">
            {selectedLayer.featureCount}
          </Badge>
          <ChevronUp className="w-4 h-4 ml-1 opacity-50" />
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
                  Displaying {selectedLayer.featureCount} records from the active layer.
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
            <ScrollArea className="h-full">
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
                  {selectedLayer.data.features.map((feature, idx) => (
                    <TableRow 
                      key={idx} 
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
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
