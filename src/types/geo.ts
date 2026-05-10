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

export type BaseLayerType = 'osm' | 'satellite' | 'dark';

export interface MapState {
  layers: MapLayer[];
  selectedLayerId: string | null;
  baseLayer: BaseLayerType;
  isLoading: boolean;
  addLayer: (layer: MapLayer) => void;
  removeLayer: (id: string) => void;
  toggleLayerVisibility: (id: string) => void;
  updateLayerColor: (id: string, color: string) => void;
  setBaseLayer: (type: BaseLayerType) => void;
  setSelectedLayerId: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
}
