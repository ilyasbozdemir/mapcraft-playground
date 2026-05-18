"use client";

import { useState } from 'react';

import { 
  Eye, 
  EyeOff, 
  Trash2, 
  Layers, 
  MoreVertical, 
  Share2, 
  Download,
  FolderPlus,
  Folder,
  ChevronDown,
  ChevronRight,
  GripVertical,
  BoxSelect,
  MapPin,
  Activity,
  Square,
  FolderTree,
  Sparkles,
  Target,
  Info
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
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu';
import { formatSize } from '@/lib/geoUtils';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { FileUploader } from '@/components/FileUploader';
import { StudioExport } from '@/components/StudioExport';
import { pointsToPolygon } from '@/lib/TurfUtils';

export function LayerPanel() {
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);
  const [displayLimits, setDisplayLimits] = useState<Record<string, number>>({});
  const [expandedProps, setExpandedProps] = useState<Record<string, boolean>>({});
  const { 
    layers, 
    groups,
    removeLayer, 
    toggleLayerVisibility, 
    updateLayerColor, 
    selectedLayerId, 
    setSelectedLayerId,
    addGroup,
    removeGroup,
    updateGroup,
    updateLayer,
    moveLayerToGroup,
    selectedFeature,
    setSelectedFeature
  } = useMapStore();

  const convertToPolygon = (layerId: string) => {
    const layer = layers.find(l => l.id === layerId);
    if (!layer || layer.geometryType !== 'Point') return;
    
    const coords = layer.data.features
      .filter(f => f.geometry.type === 'Point')
      .map(f => (f.geometry as import('geojson').Point).coordinates);

    if (coords.length < 3) {
      toast.error('Need at least 3 points');
      return;
    }

    const polygon = pointsToPolygon(coords);
    if (polygon) {
      updateLayer(layerId, { 
        data: { type: 'FeatureCollection', features: [polygon] }, 
        geometryType: 'Polygon',
        featureCount: 1 
      });
      toast.success('Converted points to polygon');
    }
  };

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

  const createGroup = () => {
    const newGroup = {
      id: crypto.randomUUID(),
      name: 'New Group',
      visible: true,
      collapsed: false
    };
    addGroup(newGroup);
    toast.success('Group created');
  };

  const analyzeLayerFeatures = (layer: import('@/types/geo').MapLayer) => {
    const features = layer.data?.features || [];
    const total = features.length;
    
    const geoCounts: Record<string, number> = {
      Point: 0,
      LineString: 0,
      Polygon: 0,
      Other: 0
    };

    const folders: Record<string, { feature: import('geojson').Feature; index: number }[]> = {};
    const allProps: Record<string, number> = {};
    let totalPropsCount = 0;

    features.forEach((feat, index) => {
      // Geometry count
      const gType = feat.geometry?.type;
      if (gType === 'Point' || gType === 'MultiPoint') geoCounts.Point = (geoCounts.Point || 0) + 1;
      else if (gType === 'LineString' || gType === 'MultiLineString') geoCounts.LineString = (geoCounts.LineString || 0) + 1;
      else if (gType === 'Polygon' || gType === 'MultiPolygon') geoCounts.Polygon = (geoCounts.Polygon || 0) + 1;
      else geoCounts.Other = (geoCounts.Other || 0) + 1;

      // Folder / Category grouping
      const props = feat.properties || {};
      const folderName = props.folder || props.Folder || props.layer || props.Layer || props.category || props.Category || 'Root / Default';
      if (!folders[folderName]) folders[folderName] = [];
      folders[folderName].push({ feature: feat, index });

      // Properties stats
      const keys = Object.keys(props);
      totalPropsCount += keys.length;
      keys.forEach(k => {
        allProps[k] = (allProps[k] || 0) + 1;
      });
    });

    const avgProps = total > 0 ? Math.round(totalPropsCount / total) : 0;
    const sortedProps = Object.entries(allProps).sort((a, b) => b[1] - a[1]).slice(0, 3).map(p => p[0]);

    // Dominant geometry
    let dominantGeo = 'Mixed';
    let maxCount = 0;
    Object.entries(geoCounts).forEach(([ type, count ]) => {
      if (count > maxCount) {
        maxCount = count;
        dominantGeo = type;
      }
    });

    // Generate insight
    let insight = `Layer contains ${total} features. `;
    if (dominantGeo !== 'Mixed' && maxCount > 0) {
      insight += `Predominantly composed of ${dominantGeo}s (${Math.round((maxCount/total)*100)}%). `;
    }
    if (sortedProps.length > 0) {
      insight += `Key attributes detected: ${sortedProps.join(', ')} (avg. ${avgProps} fields/feature).`;
    } else {
      insight += `No significant attribute schema detected.`;
    }

    return {
      total,
      geoCounts,
      folders,
      avgProps,
      sortedProps,
      insight,
      dominantGeo
    };
  };

  const renderLayer = (layer: import('@/types/geo').MapLayer) => {
    const isCollapsed = layer.collapsed !== false; // default true (collapsed)
    const analysis = !isCollapsed ? analyzeLayerFeatures(layer) : null;

    return (
      <div 
        key={layer.id}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('layerId', layer.id);
          e.dataTransfer.effectAllowed = 'move';
        }}
        className={cn(
          "group relative p-3 rounded-xl border transition-all duration-200 cursor-grab active:cursor-grabbing mb-2 bg-background",
          selectedLayerId === layer.id 
            ? "border-primary bg-primary/5 shadow-[0_4px_12px_rgba(var(--primary),0.1)]" 
            : "border-border/50 hover:border-primary/30 hover:bg-accent/30"
        )}
        onClick={() => setSelectedLayerId(layer.id)}
      >
        {/* Header Row */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center flex-1 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-lg mr-1 shrink-0 hover:bg-accent"
              onClick={(e) => {
                e.stopPropagation();
                updateLayer(layer.id, { collapsed: !isCollapsed });
              }}
            >
              {isCollapsed ? (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-primary" />
              )}
            </Button>
            <GripVertical className="w-3.5 h-3.5 text-muted-foreground/30 cursor-grab active:cursor-grabbing hover:text-primary transition-colors shrink-0 mr-1" />
            <div className="flex flex-col min-w-0 flex-1">
              <input
                title="Edit layer name"
                className="font-bold text-xs truncate bg-transparent border-none focus:ring-1 focus:ring-primary rounded px-1 w-full outline-none"
                value={layer.name}
                onChange={(e) => updateLayer(layer.id, { name: e.target.value })}
                onClick={(e) => e.stopPropagation()}
              />
              <div className="flex w-full items-center gap-2 mt-0.5 px-1">
                <span className="text-[9px] font-black uppercase tracking-widest text-primary/70">
                  {layer.type}
                </span>
                <span className="text-[9px] text-muted-foreground font-medium uppercase tracking-tighter">
                  {layer.featureCount} obj • {formatSize(layer.size)}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-1 shrink-0">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6 rounded-lg" 
              onClick={(e) => {
                e.stopPropagation();
                toggleLayerVisibility(layer.id);
              }}
            >
              {layer.visible ? (
                <Eye className="w-3.5 h-3.5 text-primary" />
              ) : (
                <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger render={
                <Button variant="ghost" size="icon" className="h-6 w-6 rounded-lg">
                  <MoreVertical className="w-3.5 h-3.5" />
                </Button>
              } />
              <DropdownMenuContent align="end" className="w-48 rounded-xl p-1.5">
                <DropdownMenuItem onClick={() => exportLayer(layer.id)}>
                  <Download className="w-3.5 h-3.5 mr-2" />
                  GeoJSON Export
                </DropdownMenuItem>
                {layer.geometryType === 'Point' && layer.featureCount >= 3 && (
                  <DropdownMenuItem onClick={() => convertToPolygon(layer.id)}>
                    <BoxSelect className="w-3.5 h-3.5 mr-2" />
                    Convert to Polygon
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-[9px] uppercase tracking-widest font-black px-2 py-1.5 opacity-50">Move to Group</DropdownMenuLabel>
                  {groups.map(g => (
                    <DropdownMenuItem 
                      key={g.id} 
                      onClick={() => moveLayerToGroup(layer.id, g.id)}
                      className={cn(layer.groupId === g.id && "bg-primary/10 text-primary font-bold")}
                    >
                      <Folder className="w-3.5 h-3.5 mr-2" />
                      {g.name}
                    </DropdownMenuItem>
                  ))}
                  {layer.groupId && (
                    <DropdownMenuItem onClick={() => moveLayerToGroup(layer.id, undefined)}>
                      <Layers className="w-3.5 h-3.5 mr-2" />
                      Remove from Group
                    </DropdownMenuItem>
                  )}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => removeLayer(layer.id)} className="text-destructive focus:bg-destructive/10">
                  <Trash2 className="w-3.5 h-3.5 mr-2" />
                  Remove Layer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Color & Geometry Type Row */}
        <div className="flex items-center gap-2 pl-7">
          <div 
            className="w-2.5 h-2.5 rounded-full ring-1 ring-white/10" 
            style={{ backgroundColor: layer.color }}
          />
          <input 
            type="color" 
            title="Change layer color"
            value={layer.color} 
            onChange={(e) => updateLayerColor(layer.id, e.target.value)}
            className="w-4 h-4 p-0 border-none bg-transparent cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          />
          <span className="text-[9px] font-mono text-muted-foreground/60 uppercase ml-auto">
            {layer.geometryType}
          </span>
        </div>

        {/* Collapsed / Expanded Content (The AI Interpretation & Breakdown) */}
        {!isCollapsed && analysis && (
          <div className="mt-3 pt-3 border-t border-border/40 space-y-3 cursor-default" onClick={(e) => e.stopPropagation()}>
            {/* AI Insights Box */}
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-2.5 shadow-sm backdrop-blur-sm">
              <div className="flex items-center gap-1.5 mb-1 text-primary">
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span className="text-[10px] font-black uppercase tracking-wider">AI Layer Interpretation</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed font-medium">
                {analysis.insight}
              </p>
            </div>

            {/* Geometry Breakdown */}
            <div>
              <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 px-1">
                Geometry Breakdown
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <div className="flex flex-col items-center justify-center p-1.5 rounded-lg bg-accent/40 border border-border/50">
                  <div className="flex items-center gap-1 text-[10px] font-bold text-foreground">
                    <MapPin className="w-3 h-3 text-emerald-500" />
                    <span>{analysis.geoCounts.Point}</span>
                  </div>
                  <span className="text-[9px] text-muted-foreground font-medium uppercase mt-0.5">Points</span>
                </div>
                <div className="flex flex-col items-center justify-center p-1.5 rounded-lg bg-accent/40 border border-border/50">
                  <div className="flex items-center gap-1 text-[10px] font-bold text-foreground">
                    <Activity className="w-3 h-3 text-blue-500" />
                    <span>{analysis.geoCounts.LineString}</span>
                  </div>
                  <span className="text-[9px] text-muted-foreground font-medium uppercase mt-0.5">Lines</span>
                </div>
                <div className="flex flex-col items-center justify-center p-1.5 rounded-lg bg-accent/40 border border-border/50">
                  <div className="flex items-center gap-1 text-[10px] font-bold text-foreground">
                    <Square className="w-3 h-3 text-purple-500" />
                    <span>{analysis.geoCounts.Polygon}</span>
                  </div>
                  <span className="text-[9px] text-muted-foreground font-medium uppercase mt-0.5">Polygons</span>
                </div>
              </div>
            </div>

            {/* Folders & Features Structure */}
            <div>
              <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 px-1 flex items-center justify-between">
                <span>Features Structure</span>
                <span className="text-[9px] font-normal text-muted-foreground/70">({analysis.total} total)</span>
              </div>
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
                {Object.entries(analysis.folders).map(([folderName, items]) => {
                  const folderKey = `${layer.id}-${folderName}`;
                  const currentLimit = displayLimits[folderKey] || 50;

                  return (
                    <div key={folderName} className="border border-border/40 rounded-lg overflow-hidden bg-accent/10">
                      <div className="flex items-center justify-between px-2.5 py-1.5 bg-accent/30 border-b border-border/30">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <FolderTree className="w-3.5 h-3.5 text-primary/70 shrink-0" />
                          <span className="text-[10px] font-bold truncate text-foreground">{folderName}</span>
                        </div>
                        <Badge variant="secondary" className="text-[9px] font-mono px-1.5 py-0 h-4">
                          {items.length}
                        </Badge>
                      </div>
                      <div 
                        className="divide-y divide-border/30 max-h-[140px] overflow-y-auto"
                        onScroll={(e) => {
                          const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
                          if (scrollHeight - scrollTop - clientHeight < 40) {
                            if (currentLimit < items.length) {
                              setDisplayLimits(prev => ({
                                ...prev,
                                [folderKey]: Math.min((prev[folderKey] || 50) + 100, items.length)
                              }));
                            }
                          }
                        }}
                      >
                        {items.slice(0, currentLimit).map(({ feature, index }) => {
                          const featId = index.toString();
                          const isSelected = selectedFeature?.layerId === layer.id && selectedFeature?.featureId === featId;
                          const gType = feature.geometry?.type;
                          const props = feature.properties || {};
                          const name = props.name || props.Name || props.title || `Feature #${index + 1}`;
                          
                          // Öne çıkan diğer nitelik (sub-label / kategori / stil)
                          const subLabel = props.styleUrl || props.category || props.Category || props.type || props.Type || props.class || props.description;
                          const propKeys = Object.keys(props);
                          const propKeyStr = `${layer.id}-${featId}`;
                          const isPropsExpanded = expandedProps[propKeyStr] || false;

                          return (
                            <div key={`${layer.id}-${folderName}-${index}`} className="flex flex-col border-b border-border/20 last:border-none">
                              <div
                                onClick={() => setSelectedFeature({ layerId: layer.id, featureId: featId })}
                                className={cn(
                                  "flex items-center justify-between px-2.5 py-1.5 text-[10px] cursor-pointer transition-colors group/feat",
                                  isSelected ? "bg-primary/15 font-bold text-primary" : "text-muted-foreground hover:bg-primary/10 hover:text-foreground"
                                )}
                              >
                                <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-2">
                                  {gType === 'Point' || gType === 'MultiPoint' ? (
                                    <MapPin className="w-3 h-3 text-emerald-500 shrink-0" />
                                  ) : gType === 'LineString' || gType === 'MultiLineString' ? (
                                    <Activity className="w-3 h-3 text-blue-500 shrink-0" />
                                  ) : (
                                    <Square className="w-3 h-3 text-purple-500 shrink-0" />
                                  )}
                                  <div className="flex flex-col min-w-0 flex-1">
                                    <span className="truncate font-semibold text-foreground">{name}</span>
                                    {subLabel && (
                                      <span className="truncate text-[8.5px] text-muted-foreground/80 font-mono -mt-0.5">
                                        {String(subLabel).replace(/^#/, '')}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  {propKeys.length > 0 && (
                                    <Button
                                      variant="ghost" 
                                      size="sm"
                                      title="Öznitelikleri Göster / Gizle"
                                      className={cn(
                                        "h-5 px-1.5 py-0 text-[8.5px] font-mono rounded hover:bg-accent hover:text-accent-foreground",
                                        isPropsExpanded ? "bg-primary/20 text-primary font-bold" : "text-muted-foreground/70"
                                      )}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setExpandedProps(prev => ({ ...prev, [propKeyStr]: !isPropsExpanded }));
                                      }}
                                    >
                                      <Info className="w-2.5 h-2.5 mr-1 inline-block" />
                                      {propKeys.length} props
                                    </Button>
                                  )}
                                  <div 
                                    title="Haritada Odaklan (Focus)"
                                    className="w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover/feat:opacity-100 transition-opacity bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedFeature({ layerId: layer.id, featureId: featId });
                                    }}
                                  >
                                    <Target className="w-3 h-3" />
                                  </div>
                                </div>
                              </div>

                              {/* Genişletilmiş Öznitelik Tablosu (Expanded Props) */}
                              {isPropsExpanded && propKeys.length > 0 && (
                                <div className="bg-accent/30 p-2 border-t border-border/30 text-[9px] space-y-1 font-mono cursor-default" onClick={e => e.stopPropagation()}>
                                  <div className="text-[8px] font-black uppercase tracking-wider text-muted-foreground mb-1 border-b border-border/40 pb-0.5 flex items-center justify-between">
                                    <span>Nitelik Detayları (Attributes)</span>
                                    <span className="text-primary font-bold">{name}</span>
                                  </div>
                                  <div className="grid grid-cols-1 gap-1 max-h-[120px] overflow-y-auto pr-1 custom-scrollbar">
                                    {propKeys.map(k => (
                                      <div key={k} className="flex items-start justify-between gap-2 bg-background/50 px-1.5 py-0.5 rounded border border-border/30">
                                        <span className="font-bold text-muted-foreground truncate max-w-[100px]">{k}:</span>
                                        <span className="text-foreground truncate font-sans text-[9.5px]" title={String(props[k])}>
                                          {String(props[k])}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {items.length > currentLimit && (
                          <div className="text-[9px] text-center py-1.5 text-muted-foreground/60 bg-accent/20 font-medium animate-pulse flex items-center justify-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping"></span>
                            <span>Scroll down to load more ({items.length - currentLimit} remaining)...</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-background border-r border-border/40 w-[320px] shadow-2xl">
      <div className="p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Layers className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-black text-sm uppercase tracking-widest leading-none">Layers</h2>
            <p className="text-[10px] text-muted-foreground font-medium mt-1">Management Console</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="rounded-xl" onClick={createGroup}>
          <FolderPlus className="w-4 h-4" />
        </Button>
      </div>
      
      <Separator className="opacity-50" />

      <ScrollArea className="flex-1 px-4 py-2">
        <div className="space-y-6 py-4">
          {/* Groups */}
          {groups.map(group => (
            <div 
              key={group.id} 
              className={cn("space-y-2 rounded-xl border-2 transition-all duration-200", dragOverGroupId === group.id ? "border-primary/50 bg-primary/5 p-2 -mx-2" : "border-transparent p-0")}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverGroupId(group.id);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setDragOverGroupId(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverGroupId(null);
                const layerId = e.dataTransfer.getData('layerId');
                if (layerId) {
                  moveLayerToGroup(layerId, group.id);
                }
              }}
            >
              <div 
                className="flex items-center gap-2 px-2 py-1 group/group cursor-pointer"
                onClick={() => updateGroup(group.id, { collapsed: !group.collapsed })}
              >
                {group.collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                <Folder className="w-4 h-4 text-primary/70" />
                <input
                  title="Edit group name"
                  className="font-black text-[10px] uppercase tracking-[0.2em] bg-transparent border-none focus:ring-0 w-full"
                  value={group.name}
                  onChange={(e) => updateGroup(group.id, { name: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                />
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 opacity-0 group-hover/group:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeGroup(group.id);
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </div>
              
              {!group.collapsed && (
                <div className="pl-4 space-y-2 border-l border-border/50 ml-4">
                  {layers.filter(l => l.groupId === group.id).map(renderLayer)}
                  {layers.filter(l => l.groupId === group.id).length === 0 && (
                    <div className="flex flex-col items-center justify-center py-3 px-2 border-2 border-dashed border-border/50 rounded-xl bg-accent/10 mt-2 mb-1">
                      <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest text-center">Drop Layers Here</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Ungrouped Layers */}
          <div 
            className={cn("space-y-3 rounded-xl border-2 transition-all duration-200", dragOverGroupId === 'uncategorized' ? "border-primary/50 bg-primary/5 p-2 -mx-2" : "border-transparent p-0")}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverGroupId('uncategorized');
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setDragOverGroupId(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragOverGroupId(null);
              const layerId = e.dataTransfer.getData('layerId');
              if (layerId) {
                moveLayerToGroup(layerId, undefined);
              }
            }}
          >
            {groups.length > 0 && layers.some(l => !l.groupId) && (
              <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground px-2">Uncategorized</h3>
            )}
            {layers.filter(l => !l.groupId).map(renderLayer)}
            
            {layers.length > 0 && (
              <div className="mt-4">
                <FileUploader compact className="bg-background/50 backdrop-blur-sm" />
              </div>
            )}
          </div>

          {layers.length === 0 && groups.length === 0 && (
            <div className="flex flex-col items-center justify-center p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-accent/30 flex items-center justify-center mb-6 border border-border/50 shadow-inner">
                <Layers className="w-8 h-8 text-muted-foreground/50" />
              </div>
              <FileUploader compact className="w-full bg-background/50 backdrop-blur-sm" />
            </div>
          )}
        </div>
      </ScrollArea>
      
      <div className="p-5 bg-accent/20 border-t border-border/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-primary" />
            <span className="text-[10px] font-black uppercase tracking-widest">Project Archive</span>
          </div>
          <Badge variant="outline" className="text-[9px] font-mono border-primary/20 text-primary">MAPCRAFT V1</Badge>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            className="text-[10px] h-9 font-bold uppercase tracking-widest rounded-xl hover:bg-primary/5"
            onClick={() => {
              navigator.clipboard.writeText(JSON.stringify(layers));
              toast.success('Layers data copied to clipboard');
            }}
            disabled={layers.length === 0}
          >
            Copy Data
          </Button>
          <StudioExport />
        </div>
      </div>
    </div>
  );
}
