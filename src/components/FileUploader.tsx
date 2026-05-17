"use client";

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useMapStore } from '@/hooks/useMapStore';
import { parseKML, parseKMZ } from '@/lib/parsers/parseKML';
import { parseGPX } from '@/lib/parsers/parseGPX';
import { getRandomColor, getGeometryType } from '@/lib/geoUtils';
import { MapLayer } from '@/types/geo';
import { cn } from '@/lib/utils';

// Yeni Gelişmiş Ayrıştırıcılar ve Kadastro Modülleri
import { importShapefileAdvanced } from '@/lib/parsers/ShapefileImporter';
import { loadGeoJSONStreamPipeline, parseKMLStreamingSAX, parseJSONVariantsAndCSV } from '@/lib/parsers/BigDataLoader';
import { analyzeCadastralFeature, getZoningColor } from '@/lib/CadastralSupport';

export function FileUploader({ className, compact = false }: { className?: string, compact?: boolean }) {
  const [isParsing, setIsParsing] = useState(false);
  const addLayer = useMapStore((state) => state.addLayer);
  const updateLayer = useMapStore((state) => state.updateLayer);
  const setLoading = useMapStore((state) => state.setLoading);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    setIsParsing(true);
    setLoading(true);

    try {
      // 1. Shapefile bileşenleri (.shp, .dbf, .shx, .prj) veya Netcad/Shapefile arşivleri (.ncz, .zip)
      const shpGroupFiles = acceptedFiles.filter(f => 
        ['.shp', '.dbf', '.shx', '.prj', '.ncz', '.zip'].some(ext => f.name.toLowerCase().endsWith(ext))
      );

      // Sadece .shp, .ncz veya tekil bir .zip arşivi varsa Shapefile modülünü devreye al
      const hasShpOrNcz = shpGroupFiles.some(f => 
        ['.shp', '.ncz'].some(ext => f.name.toLowerCase().endsWith(ext)) ||
        (f.name.toLowerCase().endsWith('.zip') && shpGroupFiles.length === 1)
      );

      if (hasShpOrNcz) {
        const primaryFile = shpGroupFiles.find(f => ['.shp', '.ncz', '.zip'].some(ext => f.name.toLowerCase().endsWith(ext))) || shpGroupFiles[0];
        const toastId = crypto.randomUUID();
        toast.loading(`Shapefile / Netcad yükleniyor: ${primaryFile.name}...`, { id: toastId });

        try {
          const data = await importShapefileAdvanced(shpGroupFiles, (progress, statusText) => {
            toast.loading(`${statusText} (%${progress})`, { id: toastId });
          });

          // Kadastro / İmar analizi ve renk ataması
          data.features.forEach(f => {
            const cad = analyzeCadastralFeature(f.properties);
            if (cad.isZoning && cad.zoningFunction) {
              // @ts-expect-error - custom property for zoning
              f.properties._zoningColor = getZoningColor(cad.zoningFunction);
            }
          });

          const firstZoningColor = data.features.find(f => f.properties?._zoningColor)?.properties?._zoningColor;

          const layer: MapLayer = {
            id: crypto.randomUUID(),
            name: primaryFile.name.replace(/\.(shp|ncz|zip)$/i, ''),
            type: 'shapefile',
            data,
            visible: true,
            color: firstZoningColor || getRandomColor(),
            geometryType: getGeometryType(data) as any,
            featureCount: data.features.length,
            size: shpGroupFiles.reduce((acc, f) => acc + f.size, 0),
            createdAt: Date.now(),
          };
          addLayer(layer);
          toast.success(`Başarıyla Yüklendi: ${layer.name} (${data.features.length} obje)`, { id: toastId });
        } catch (err: any) {
          toast.error(`Shapefile yükleme hatası: ${err.message}`, { id: toastId });
        }
      }

      // 2. Diğer dosyaların işlenmesi (geojson, json, kml, kmz, gpx, csv, mapcraft)
      for (const file of acceptedFiles) {
        const extension = file.name.split('.').pop()?.toLowerCase() || '';
        
        // Shapefile grubunda işlenmiş dosyaları atla
        if (hasShpOrNcz && ['shp', 'dbf', 'shx', 'prj', 'ncz', 'zip'].includes(extension)) continue;

        let data: any;
        let type: MapLayer['type'] = 'geojson';
        const layerId = crypto.randomUUID();

        try {
          // A. Büyük GeoJSON / JSON / CSV Akışı (10 MB üzeri)
          if (['geojson', 'json', 'csv'].includes(extension) && file.size > 10 * 1024 * 1024) {
            let isFirstBatch = true;
            let totalFeatures = 0;
            const toastId = layerId;

            toast.loading(`Büyük Veri Akışı Başladı: ${file.name}...`, { id: toastId });

            await loadGeoJSONStreamPipeline(file, (batch) => {
              totalFeatures += batch.length;
              if (isFirstBatch) {
                const initialData: import('geojson').FeatureCollection = { type: 'FeatureCollection', features: [...batch] };
                const layer: MapLayer = {
                  id: layerId,
                  name: `${file.name} (Yükleniyor...)`,
                  type: 'geojson',
                  data: initialData,
                  visible: true,
                  color: getRandomColor(),
                  geometryType: getGeometryType(initialData) as any,
                  featureCount: batch.length,
                  size: file.size,
                  createdAt: Date.now(),
                };
                addLayer(layer);
                isFirstBatch = false;
              } else {
                const currentLayer = useMapStore.getState().layers.find(l => l.id === layerId);
                if (currentLayer) {
                  // O(1) in-place push ile React/Zustand bellek şişmesini ve yavaşlamasını tamamen engeller
                  currentLayer.data.features.push(...batch);
                  currentLayer.featureCount = totalFeatures;

                  // UI kilitlenmesini önlemek için sadece her 25.000 objede bir Zustand store güncellemesi tetikle
                  if (totalFeatures % 25000 < batch.length) {
                    updateLayer(layerId, { 
                      featureCount: totalFeatures,
                      name: `${file.name} (${totalFeatures.toLocaleString()} obje)`
                    });
                  }
                }
              }
              toast.loading(`Akış devam ediyor: ${file.name} (${totalFeatures.toLocaleString()} obje okundu)...`, { id: toastId });
            }, 2500); // Batch boyutunu 500 yerine 2500 yaparak performansı 5 katına çıkarıyoruz
            
            // Akış bittiğinde son bir tam güncelleme ile haritayı render et
            const finalLayer = useMapStore.getState().layers.find(l => l.id === layerId);
            if (finalLayer) {
              updateLayer(layerId, { 
                data: { ...finalLayer.data },
                featureCount: totalFeatures,
                name: `${file.name} (${totalFeatures.toLocaleString()} obje)`
              });
            }

            toast.success(`Büyük Veri Tamamlandı: ${file.name} (${totalFeatures.toLocaleString()} obje)`, { id: toastId });
            continue;
          }

          // B. Normal GeoJSON / JSON / CSV / TopoJSON / PostGIS (10 MB altı)
          if (['geojson', 'json', 'csv'].includes(extension)) {
            data = await parseJSONVariantsAndCSV(file);
            type = 'geojson';
          } 
          // C. MVT / PBF / MBTILES Vektör Karoları
          else if (['mvt', 'pbf', 'mbtiles'].includes(extension)) {
            const mvtUrl = URL.createObjectURL(file);
            const layer: MapLayer = {
              id: layerId,
              name: file.name,
              type: 'mvt',
              data: { type: 'FeatureCollection', features: [] },
              visible: true,
              color: getRandomColor(),
              geometryType: 'Mixed',
              featureCount: 0,
              size: file.size,
              createdAt: Date.now(),
              mvtUrl,
            };
            addLayer(layer);
            toast.success(`MVT Vektör Karosu Yüklendi: ${file.name}`);
            continue;
          }
          // D. Mapcraft Proje Dosyası
          else if (extension === 'mapcraft') {
            const text = await file.text();
            const project = JSON.parse(text);
            if (project.layers) {
              project.layers.forEach((l: any) => addLayer(l));
              if (project.groups) {
                project.groups.forEach((g: any) => useMapStore.getState().addGroup(g));
              }
              if (project.baseLayer) useMapStore.getState().setBaseLayer(project.baseLayer);
              toast.success(`Proje Yüklendi: ${file.name}`);
              continue;
            }
          } 
          // E. Büyük KML Akışı (5 MB üzeri)
          else if (extension === 'kml' && file.size > 5 * 1024 * 1024) {
            let isFirstBatch = true;
            let totalFeatures = 0;
            const toastId = layerId;

            toast.loading(`Büyük KML Akışı Başladı: ${file.name}...`, { id: toastId });

            await parseKMLStreamingSAX(file, (batch) => {
              totalFeatures += batch.length;
              if (isFirstBatch) {
                const initialData: import('geojson').FeatureCollection = { type: 'FeatureCollection', features: [...batch] };
                const layer: MapLayer = {
                  id: layerId,
                  name: `${file.name} (Yükleniyor...)`,
                  type: 'kml',
                  data: initialData,
                  visible: true,
                  color: getRandomColor(),
                  geometryType: getGeometryType(initialData) as any,
                  featureCount: batch.length,
                  size: file.size,
                  createdAt: Date.now(),
                };
                addLayer(layer);
                isFirstBatch = false;
              } else {
                const currentLayer = useMapStore.getState().layers.find(l => l.id === layerId);
                if (currentLayer) {
                  currentLayer.data.features.push(...batch);
                  currentLayer.featureCount = totalFeatures;

                  if (totalFeatures % 25000 < batch.length) {
                    updateLayer(layerId, { 
                      featureCount: totalFeatures,
                      name: `${file.name} (${totalFeatures.toLocaleString()} obje)`
                    });
                  }
                }
              }
              toast.loading(`KML Akışı devam ediyor: ${file.name} (${totalFeatures.toLocaleString()} obje okundu)...`, { id: toastId });
            });
            
            const finalLayer = useMapStore.getState().layers.find(l => l.id === layerId);
            if (finalLayer) {
              updateLayer(layerId, { 
                data: { ...finalLayer.data },
                featureCount: totalFeatures,
                name: `${file.name} (${totalFeatures.toLocaleString()} obje)`
              });
            }

            toast.success(`KML Akışı Tamamlandı: ${file.name} (${totalFeatures.toLocaleString()} obje)`, { id: toastId });
            continue;
          }

          // F. Normal KML / KMZ (5 MB altı)
          else if (extension === 'kml') {
            data = await parseKML(file);
            type = 'kml';
          } else if (extension === 'kmz') {
            data = await parseKMZ(file);
            type = 'kmz';
          } 
          // G. GPX
          else if (extension === 'gpx') {
            data = await parseGPX(file);
            type = 'gpx';
          } else {
            continue;
          }

          // Kadastro / İmar analizi
          if (data && data.features) {
            data.features.forEach((f: any) => {
              const cad = analyzeCadastralFeature(f.properties);
              if (cad.isZoning && cad.zoningFunction) {
                f.properties._zoningColor = getZoningColor(cad.zoningFunction);
              }
            });
          }

          const firstZoningColor = data?.features?.find((f: any) => f.properties?._zoningColor)?.properties?._zoningColor;

          const layer: MapLayer = {
            id: layerId,
            name: file.name,
            type,
            data,
            visible: true,
            color: firstZoningColor || getRandomColor(),
            geometryType: getGeometryType(data) as any,
            featureCount: data.features.length,
            size: file.size,
            createdAt: Date.now(),
          };
          addLayer(layer);
          toast.success(`Başarıyla Yüklendi ${extension.toUpperCase()}: ${file.name}`);
        } catch (err: any) {
          console.error(err);
          toast.error(`Dosya ayrıştırma hatası (${file.name}): ${err.message}`);
        }
      }
    } catch (err: any) {
      toast.error(`Dosya işleme hatası: ${err.message}`);
    } finally {
      setIsParsing(false);
      setLoading(false);
    }
  }, [addLayer, updateLayer, setLoading]);

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
      <div className={cn(
        "rounded-full bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300",
        compact ? "w-10 h-10 mb-2" : "w-16 h-16 mb-4"
      )}>
        {isParsing ? (
          <Loader2 className={cn("text-primary animate-spin", compact ? "w-5 h-5" : "w-8 h-8")} />
        ) : (
          <Upload className={cn("text-primary", compact ? "w-5 h-5" : "w-8 h-8")} />
        )}
      </div>
      <h3 className={cn("font-semibold mb-1", compact ? "text-sm" : "text-lg")}>
        {isDragActive ? "Drop files here" : "Import Geo Data"}
      </h3>
      <p className={cn("text-muted-foreground max-w-xs", compact ? "text-[10px]" : "text-sm")}>
        Drag & drop .geojson, .kml, .kmz, .shp (zip), .ncz, .csv, .mvt, .pbf or .gpx files.
        {!compact && " For shapefiles, drop .shp, .dbf, .shx, and .prj together."}
      </p>
      
      {isParsing && (
        <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center rounded-xl z-10">
          <div className="flex flex-col items-center">
            <Loader2 className="w-10 h-10 text-primary animate-spin mb-2" />
            <span className="text-sm font-medium">Coğrafi veriler işleniyor...</span>
          </div>
        </div>
      )}
    </div>
  );
}
