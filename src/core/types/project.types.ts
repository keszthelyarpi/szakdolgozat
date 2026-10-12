export interface Point {
  x: number;
  y: number;
}

export interface Wall {
  id: string;
  startPoint: Point;
  endPoint: Point;
  thickness: number;
  isDrillable: boolean;
}

export interface CentralUnit {
  position: Point;
}

export interface Outlet {
  id: string;
  position: Point;
  coverageRadius: number;
}

export interface ElevationPoint {
  position: Point;
  heightValue: number;
}

export interface Zone {
  id: string;
  points: Point[];
  isFloorZone: boolean;
}

export interface Waypoint {
  position: Point;
}

export interface BreakthroughPoint {
  position: Point;
}

export interface Product {
  id: string;
  name: string;
  price: number;
}

export interface OfferItem {
  product: Product;
  quantity: number;
}

export interface Offer {
  totalPrice: number;
  items: OfferItem[];
}

export interface Project {
  projectName: string;
  walls: Wall[];
  centralUnit: CentralUnit;
  outlets: Outlet[];
  zones: Zone[];
  elevationPoints: ElevationPoint[];
  waypoints: Waypoint[];
  breakthroughPoints: BreakthroughPoint[];
  offer: Offer;
}
