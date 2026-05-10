import { create } from 'zustand';
import { MapState } from '@/types/geo';

export const useMapStore = create<MapState>((set) => ({
  layers: [],
  selectedLayerId: null,
  baseLayer: 'osm',
  customBaseUrl: '',
  drawingMode: 'none',
  isLoading: false,
  addLayer: (layer) => set((state) => ({ 
    layers: [...state.layers, layer],
    selectedLayerId: layer.id 
  })),
  removeLayer: (id) => set((state) => ({ 
    layers: state.layers.filter((l) => l.id !== id),
    selectedLayerId: state.selectedLayerId === id ? null : state.selectedLayerId
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
  setBaseLayer: (baseLayer) => set({ baseLayer }),
  setCustomBaseUrl: (customBaseUrl) => set({ customBaseUrl }),
  setDrawingMode: (drawingMode) => set({ drawingMode }),
  setSelectedLayerId: (selectedLayerId) => set({ selectedLayerId }),
  setLoading: (isLoading) => set({ isLoading }),
}));
