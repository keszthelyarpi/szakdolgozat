import { z } from 'zod';
import type { Project } from '../types/project.types';

export const pointSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const wallSchema = z.object({
  id: z.string(),
  startPoint: pointSchema,
  endPoint: pointSchema,
  thickness: z.number().positive('Wall thickness must be greater than 0'),
  isDrillable: z.boolean(),
});

export const centralUnitSchema = z.object({
  position: pointSchema,
});

export const outletSchema = z.object({
  id: z.string(),
  position: pointSchema,
  coverageRadius: z.number().positive('Coverage radius must be greater than 0'),
});

export const elevationPointSchema = z.object({
  position: pointSchema,
  heightValue: z.number(),
});

export const zoneSchema = z.object({
  id: z.string(),
  points: z.array(pointSchema).min(3, 'Zone must have at least 3 points'),
  isFloorZone: z.boolean(),
});

export const waypointSchema = z.object({
  position: pointSchema,
});

export const breakthroughPointSchema = z.object({
  position: pointSchema,
});

export const productSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number().min(0, 'Price must be non-negative'),
});

export const offerItemSchema = z.object({
  product: productSchema,
  quantity: z.number().int().positive('Quantity must be a positive integer'),
});

export const offerSchema = z.object({
  totalPrice: z.number().min(0, 'Total price must be non-negative'),
  items: z.array(offerItemSchema),
});

export const projectSchema = z.object({
  projectName: z.string().min(1, 'Project name is required'),
  walls: z.array(wallSchema),
  centralUnit: centralUnitSchema,
  outlets: z.array(outletSchema),
  zones: z.array(zoneSchema),
  elevationPoints: z.array(elevationPointSchema),
  waypoints: z.array(waypointSchema),
  breakthroughPoints: z.array(breakthroughPointSchema),
  offer: offerSchema,
});

export function validateProject(data: unknown): Project {
  return projectSchema.parse(data);
}
