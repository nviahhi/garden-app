export interface Container {
  id: number;
  user_id: number;
  name: string;
  type: 'tray' | 'pot' | 'bed' | 'greenhouse';
  x: number;
  y: number;
  width: number;
  height: number;
  cols: number | null;
  rows: number | null;
  created_at: string;
  updated_at: string;
}