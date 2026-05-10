"use client";

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useMapStore } from '@/hooks/useMapStore';
import { parseGeoJSON } from '@/lib/parsers/parseGeoJSON';
import { parseKML, parseKMZ } from '@/lib/parsers/parseKML';
import { parseGPX } from '@/lib/parsers/parseGPX';
import { parseShapefileZip, parseShapefileFiles } from '@/lib/parsers/parseShapefile';
import { getRandomColor, getGeometryType } from '@/lib/geoUtils';
import { MapLayer } from '@/types/geo';
import { cn } from '@/lib/utils';

export function FileUploader({ className }: { className?: string }) {
  const [isParsing, setIsParsing] = useState(false);
  const addLayer = useMapStore((state) => state.addLayer);
  const setLoading = useMapStore((state) => state.setLoading);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    setIsParsing(true);
    setLoading(true);

    try {
      // Handle Shapefiles (multiple files)
      const shpFiles = acceptedFiles.filter(f => 
        ['.shp', '.dbf', '.shx'].some(ext => f.name.toLowerCase().endsWith(ext))
      );

      if (shpFiles.length > 0) {
        const shp = shpFiles.find(f => f.name.toLowerCase().endsWith('.shp'));
        if (shp) {
          const data = await parseShapefileFiles(shpFiles);
          const layer: MapLayer = {
            id: crypto.randomUUID(),
            name: shp.name.replace('.shp', ''),
            type: 'shapefile',
            data,
            visible: true,
            color: getRandomColor(),
            geometryType: getGeometryType(data) as any,
            featureCount: data.features.length,
            size: shpFiles.reduce((acc, f) => acc + f.size, 0),
            createdAt: Date.now(),
          };
          addLayer(layer);
          toast.success(`Loaded Shapefile: ${layer.name}`);
        }
      }

      // Handle other files
      for (const file of acceptedFiles) {
        const extension = file.name.split('.').pop()?.toLowerCase();
        
        // Skip parts of shapefiles already handled
        if (['shp', 'dbf', 'shx'].includes(extension || '')) continue;

        let data: any;
        let type: MapLayer['type'] = 'geojson';

        try {
          if (extension === 'geojson' || extension === 'json') {
            data = await parseGeoJSON(file);
            type = 'geojson';
          } else if (extension === 'kml') {
            data = await parseKML(file);
            type = 'kml';
          } else if (extension === 'kmz') {
            data = await parseKMZ(file);
            type = 'kmz';
          } else if (extension === 'gpx') {
            data = await parseGPX(file);
            type = 'gpx';
          } else if (extension === 'zip') {
            data = await parseShapefileZip(file);
            type = 'shapefile';
          } else {
            continue;
          }

          const layer: MapLayer = {
            id: crypto.randomUUID(),
            name: file.name,
            type,
            data,
            visible: true,
            color: getRandomColor(),
            geometryType: getGeometryType(data) as any,
            featureCount: data.features.length,
            size: file.size,
            createdAt: Date.now(),
          };
          addLayer(layer);
          toast.success(`Loaded ${extension?.toUpperCase()}: ${file.name}`);
        } catch (err) {
          console.error(err);
          toast.error(`Error parsing ${file.name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }
    } catch (err) {
      toast.error('Failed to process files');
    } finally {
      setIsParsing(false);
      setLoading(false);
    }
  }, [addLayer, setLoading]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    multiple: true,
  });

  return (
    <div 
      {...getRootProps()} 
      className={cn(
        "relative group cursor-pointer border-2 border-dashed rounded-xl p-8 transition-all duration-300 flex flex-col items-center justify-center text-center",
        isDragActive ? "border-primary bg-primary/5 scale-[0.99]" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-accent/50",
        className
      )}
    >
      <input {...getInputProps()} />
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
        {isParsing ? (
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        ) : (
          <Upload className="w-8 h-8 text-primary" />
        )}
      </div>
      <h3 className="text-lg font-semibold mb-1">
        {isDragActive ? "Drop files here" : "Import Geo Data"}
      </h3>
      <p className="text-sm text-muted-foreground max-w-xs">
        Drag & drop .geojson, .kml, .kmz, .shp (zip), or .gpx files.
        For shapefiles, drop .shp, .dbf, and .shx together.
      </p>
      
      {isParsing && (
        <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center rounded-xl z-10">
          <div className="flex flex-col items-center">
            <Loader2 className="w-10 h-10 text-primary animate-spin mb-2" />
            <span className="text-sm font-medium">Parsing spatial data...</span>
          </div>
        </div>
      )}
    </div>
  );
}
