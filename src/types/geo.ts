import { FeatureCollection } from 'geojson';

export type GeometryType = 
  | 'Point' 
  | 'MultiPoint' 
  | 'LineString' 
  | 'MultiLineString' 
  | 'Polygon' 
  | 'MultiPolygon' 
  | 'GeometryCollection';

export interface MapLayer {
  id: string;
  name: string;
  type: 'geojson' | 'kml' | 'kmz' | 'shapefile' | 'gpx';
  data: FeatureCollection;
  visible: boolean;
  color: string;
  geometryType: GeometryType | 'Mixed';
  featureCount: number;
  size: number;
  createdAt: number;
}

export type BaseLayerType = 'osm' | 'satellite' | 'dark' | 'custom';

export type DrawingMode = 'none' | 'polygon' | 'point' | 'line';

export interface MapState {
  layers: MapLayer[];
  selectedLayerId: string | null;
  baseLayer: BaseLayerType;
  customBaseUrl: string;
  drawingMode: DrawingMode;
  isLoading: boolean;
  addLayer: (layer: MapLayer) => void;
  removeLayer: (id: string) => void;
  toggleLayerVisibility: (id: string) => void;
  updateLayerColor: (id: string, color: string) => void;
  setBaseLayer: (type: BaseLayerType) => void;
  setCustomBaseUrl: (url: string) => void;
  setDrawingMode: (mode: DrawingMode) => void;
  setSelectedLayerId: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
}
