import { create } from 'zustand';
import { MapState } from '@/types/geo';

export const useMapStore = create<MapState>((set) => ({
  layers: [],
  groups: [],
  selectedLayerId: null,
  selectedFeature: null,
  activeFilter: null,
  baseLayer: 'osm',
  customBaseUrl: '',
  drawingMode: 'none',
  isLoading: false,
  measurementResult: null,

  addLayer: (layer) => set((state) => ({ 
    layers: [...state.layers, layer],
    selectedLayerId: layer.id 
  })),

  removeLayer: (id) => set((state) => ({ 
    layers: state.layers.filter((l) => l.id !== id),
    selectedLayerId: state.selectedLayerId === id ? null : state.selectedLayerId,
    selectedFeature: state.selectedFeature?.layerId === id ? null : state.selectedFeature,
    activeFilter: state.activeFilter?.layerId === id ? null : state.activeFilter
  })),

  updateLayer: (id, updates) => set((state) => ({
    layers: state.layers.map((l) => l.id === id ? { ...l, ...updates } : l)
  })),

  toggleLayerVisibility: (id) => set((state) => ({
    layers: state.layers.map((l) => 
      l.id === id ? { ...l, visible: !l.visible } : l
    )
  })),

  updateLayerColor: (id, color) => set((state) => ({
    layers: state.layers.map((l) => 
      l.id === id ? { ...l, color } : l
    )
  })),

  addGroup: (group) => set((state) => ({
    groups: [...state.groups, group]
  })),

  removeGroup: (id) => set((state) => ({
    groups: state.groups.filter((g) => g.id !== id),
    layers: state.layers.map((l) => l.groupId === id ? { ...l, groupId: undefined } : l)
  })),

  updateGroup: (id, updates) => set((state) => ({
    groups: state.groups.map((g) => g.id === id ? { ...g, ...updates } : g)
  })),

  setBaseLayer: (baseLayer) => set({ baseLayer }),
  setCustomBaseUrl: (customBaseUrl) => set({ customBaseUrl }),
  setDrawingMode: (drawingMode) => set({ 
    drawingMode,
    measurementResult: null // Reset measurement when mode changes
  }),
  setSelectedLayerId: (selectedLayerId) => set({ selectedLayerId }),
  setSelectedFeature: (selectedFeature) => set({ selectedFeature }),
  setActiveFilter: (activeFilter) => set({ activeFilter }),
  setLoading: (isLoading) => set({ isLoading }),
  setMeasurementResult: (measurementResult) => set({ measurementResult }),
  
  moveLayerToGroup: (layerId: string, groupId: string | undefined) => set((state) => ({
    layers: state.layers.map((l) => l.id === layerId ? { ...l, groupId } : l)
  })),
}));
