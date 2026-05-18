import { FeatureCollection } from 'geojson';

export type GeometryType = 
  | 'Point' 
  | 'MultiPoint' 
  | 'LineString' 
  | 'MultiLineString' 
  | 'Polygon' 
  | 'MultiPolygon' 
  | 'GeometryCollection';


export type BaseLayerType = 'osm' | 'satellite' | 'dark' | 'topo' | 'terrain' | 'custom';

export type DrawingMode = 'none' | 'polygon' | 'point' | 'line' | 'measure-distance' | 'measure-area' | 'select-points' | 'edit';

export interface LayerGroup {
  id: string;
  name: string;
  visible: boolean;
  collapsed: boolean;
}

export interface MapLayer {
  id: string;
  name: string;
  type: 'geojson' | 'kml' | 'kmz' | 'shapefile' | 'gpx' | 'mapcraft' | 'mvt';
  data: FeatureCollection;
  visible: boolean;
  color: string;
  geometryType: GeometryType | 'Mixed';
  featureCount: number;
  size: number;
  createdAt: number;
  groupId?: string;
  mvtUrl?: string;
  collapsed?: boolean;
}

export interface MapState {
  layers: MapLayer[];
  groups: LayerGroup[];
  selectedLayerId: string | null;
  selectedFeature: { layerId: string; featureId: string | number } | null;
  activeFilter: { layerId: string; styleUrl?: string; folderName?: string } | null;
  baseLayer: BaseLayerType;
  customBaseUrl: string;
  drawingMode: DrawingMode;
  isLoading: boolean;
  measurementResult: { value: number; unit: string; type: 'distance' | 'area' } | null;
  
  addLayer: (layer: MapLayer) => void;
  removeLayer: (id: string) => void;
  updateLayer: (id: string, updates: Partial<MapLayer>) => void;
  toggleLayerVisibility: (id: string) => void;
  updateLayerColor: (id: string, color: string) => void;
  
  addGroup: (group: LayerGroup) => void;
  removeGroup: (id: string) => void;
  updateGroup: (id: string, updates: Partial<LayerGroup>) => void;
  
  setBaseLayer: (type: BaseLayerType) => void;
  setCustomBaseUrl: (url: string) => void;
  setDrawingMode: (mode: DrawingMode) => void;
  setSelectedLayerId: (id: string | null) => void;
  setSelectedFeature: (feature: { layerId: string; featureId: string | number } | null) => void;
  setActiveFilter: (filter: { layerId: string; styleUrl?: string; folderName?: string } | null) => void;
  setLoading: (loading: boolean) => void;
  setMeasurementResult: (result: { value: number; unit: string; type: 'distance' | 'area' } | null) => void;
  moveLayerToGroup: (layerId: string, groupId: string | undefined) => void;
}
