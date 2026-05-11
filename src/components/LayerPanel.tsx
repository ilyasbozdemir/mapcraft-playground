"use client";

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
  Plus
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
} from '@/components/ui/dropdown-menu';
import { formatSize } from '@/lib/geoUtils';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function LayerPanel() {
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
    baseLayer,
    customBaseUrl,
    moveLayerToGroup
  } = useMapStore();

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

  const exportProject = () => {
    const projectData = {
      version: "1.0",
      timestamp: Date.now(),
      layers,
      groups,
      baseLayer,
      customBaseUrl
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(projectData));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `project-${new Date().toISOString().split('T')[0]}.mapcraft`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    toast.success(`Project exported as .mapcraft`);
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

  const renderLayer = (layer: import('@/types/geo').MapLayer) => (
    <div 
      key={layer.id}
      className={cn(
        "group relative p-3 rounded-xl border transition-all duration-200 cursor-pointer",
        selectedLayerId === layer.id 
          ? "border-primary bg-primary/5 shadow-[0_4px_12px_rgba(var(--primary),0.1)]" 
          : "border-border/50 hover:border-primary/30 hover:bg-accent/30"
      )}
      onClick={() => setSelectedLayerId(layer.id)}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex flex-col min-w-0 flex-1">
          <input
            title="Edit layer name"
            className="font-bold text-xs truncate bg-transparent border-none focus:ring-1 focus:ring-primary rounded px-1 -ml-1 w-full outline-none"
            value={layer.name}
            onChange={(e) => updateLayer(layer.id, { name: e.target.value })}
            onClick={(e) => e.stopPropagation()}
          />
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[9px] font-black uppercase tracking-widest text-primary/70">
              {layer.type}
            </span>
            <span className="text-[9px] text-muted-foreground font-medium uppercase tracking-tighter">
              {layer.featureCount} obj • {formatSize(layer.size)}
            </span>
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
              <DropdownMenuSeparator />
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
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => removeLayer(layer.id)} className="text-destructive focus:bg-destructive/10">
                <Trash2 className="w-3.5 h-3.5 mr-2" />
                Remove Layer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex items-center gap-2">
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
    </div>
  );

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
            <div key={group.id} className="space-y-2">
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
                    <p className="text-[10px] text-muted-foreground italic py-2 pl-2">Empty group</p>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Ungrouped Layers */}
          <div className="space-y-3">
            {groups.length > 0 && layers.some(l => !l.groupId) && (
              <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground px-2">Uncategorized</h3>
            )}
            {layers.filter(l => !l.groupId).map(renderLayer)}
            
            {layers.length > 0 && (
              <Button 
                variant="outline" 
                className="w-full border-dashed border-2 hover:border-primary/50 hover:bg-primary/5 gap-2 rounded-xl h-12 text-[10px] font-black uppercase tracking-widest mt-4"
                onClick={() => {
                  // This will trigger the file uploader via a custom event or just focus it
                  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
                  input?.click();
                }}
              >
                <Plus className="w-4 h-4" />
                Import More Data
              </Button>
            )}
          </div>

          {layers.length === 0 && groups.length === 0 && (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-accent/30 flex items-center justify-center mb-4 border border-border/50">
                <Layers className="w-8 h-8 text-muted-foreground/30" />
              </div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Workspace Empty</p>
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
          <Button 
            variant="default" 
            size="sm" 
            className="text-[10px] h-9 font-bold uppercase tracking-widest rounded-xl shadow-lg"
            onClick={exportProject}
            disabled={layers.length === 0}
          >
            Export Pack
          </Button>
        </div>
      </div>
    </div>
  );
}
