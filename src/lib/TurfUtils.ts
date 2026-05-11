import * as turf from '@turf/turf';
import { Feature, FeatureCollection, Point, Polygon, LineString, MultiPolygon, MultiLineString } from 'geojson';

/**
 * Calculates the distance between two points in kilometers or meters
 */
export const calculateDistance = (point1: number[], point2: number[], units: turf.Units = 'kilometers') => {
  const from = turf.point(point1);
  const to = turf.point(point2);
  return turf.distance(from, to, { units });
};

/**
 * Calculates the area of a polygon in square meters or square kilometers
 */
export const calculateArea = (feature: Feature<Polygon | MultiPolygon>) => {
  return turf.area(feature);
};

/**
 * Calculates the length of a line string
 */
export const calculateLength = (feature: Feature<LineString | MultiLineString>, units: turf.Units = 'kilometers') => {
  return turf.length(feature, { units });
};

/**
 * Creates a buffer around a feature
 */
export const createBuffer = (feature: any, radius: number, units: turf.Units = 'kilometers') => {
  return turf.buffer(feature, radius, { units });
};

/**
 * Calculates the center of a feature
 */
export const getCenter = (feature: any) => {
  return turf.center(feature);
};

/**
 * Check if a point is within a polygon
 */
export const isPointInPolygon = (point: number[], polygon: Feature<Polygon | MultiPolygon>) => {
  return turf.booleanPointInPolygon(turf.point(point), polygon);
};

/**
 * Converts a set of points to a polygon
 */
export const pointsToPolygon = (points: number[][]) => {
  if (points.length < 3) return null;
  // Ensure the polygon is closed
  const closedPoints = [...points];
  if (
    closedPoints[0][0] !== closedPoints[closedPoints.length - 1][0] ||
    closedPoints[0][1] !== closedPoints[closedPoints.length - 1][1]
  ) {
    closedPoints.push(closedPoints[0]);
  }
  return turf.polygon([closedPoints]);
};
