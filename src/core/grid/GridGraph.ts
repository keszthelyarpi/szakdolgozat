import type { Point } from '../types/project.types';

export interface GridCell {
  walkable: boolean;
  costMultiplier: number;
  isTurnRestricted?: boolean;
}

export class GridGraph {
  public readonly width: number;
  public readonly height: number;
  public readonly cellSize: number;
  public readonly cols: number;
  public readonly rows: number;

  private cells: GridCell[];

  constructor(width: number, height: number, cellSize: number = 100) {
    if (width <= 0 || height <= 0 || cellSize <= 0) {
      throw new Error('Grid dimensions and cellSize must be positive numbers');
    }
    this.width = width;
    this.height = height;
    this.cellSize = cellSize;

    this.cols = Math.ceil(width / cellSize);
    this.rows = Math.ceil(height / cellSize);

    this.cells = new Array(this.cols * this.rows);
    for (let i = 0; i < this.cells.length; i++) {
      this.cells[i] = {
        walkable: true,
        costMultiplier: 1.0,
      };
    }
  }

  private getIndex(gx: number, gy: number): number {
    return gy * this.cols + gx;
  }

  public worldToGrid(point: Point): { gx: number; gy: number } {
    return {
      gx: Math.floor(point.x / this.cellSize),
      gy: Math.floor(point.y / this.cellSize),
    };
  }

  public gridToWorld(gx: number, gy: number): Point {
    return {
      x: (gx + 0.5) * this.cellSize,
      y: (gy + 0.5) * this.cellSize,
    };
  }

  public isWithinBounds(gx: number, gy: number): boolean {
    return gx >= 0 && gx < this.cols && gy >= 0 && gy < this.rows;
  }

  public getCell(gx: number, gy: number): GridCell | undefined {
    if (!this.isWithinBounds(gx, gy)) {
      return undefined;
    }
    return this.cells[this.getIndex(gx, gy)];
  }

  public setCell(gx: number, gy: number, state: Partial<GridCell>): void {
    if (!this.isWithinBounds(gx, gy)) {
      return;
    }
    const cell = this.cells[this.getIndex(gx, gy)];
    Object.assign(cell, state);
  }

  public getNeighbors(
    gx: number,
    gy: number,
    allowDiagonals: boolean = false
  ): Array<{ gx: number; gy: number; cell: GridCell }> {
    const neighbors: Array<{ gx: number; gy: number; cell: GridCell }> = [];

    const offsets = allowDiagonals
      ? [
          { dx: 0, dy: -1 },
          { dx: 1, dy: 0 },
          { dx: 0, dy: 1 },
          { dx: -1, dy: 0 },
          { dx: -1, dy: -1 },
          { dx: 1, dy: -1 },
          { dx: 1, dy: 1 },
          { dx: -1, dy: 1 },
        ]
      : [
          { dx: 0, dy: -1 },
          { dx: 1, dy: 0 },
          { dx: 0, dy: 1 },
          { dx: -1, dy: 0 },
        ];

    for (const { dx, dy } of offsets) {
      const nx = gx + dx;
      const ny = gy + dy;
      if (this.isWithinBounds(nx, ny)) {
        neighbors.push({
          gx: nx,
          gy: ny,
          cell: this.cells[this.getIndex(nx, ny)],
        });
      }
    }

    return neighbors;
  }
}
