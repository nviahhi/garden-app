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

export interface Batch {
  id: number;
  species: string;
  variety: string | null;
  sowing_date: string;
  seeds_count: number;
  container_id: number | null;
  parent_batch_id: number | null;
  notes: string | null;
  created_at: string;
  plants_count?: number;
  // джойны
  container_name?: string | null;
  container_type?: string | null;
}

export interface Plant {
  id: number;
  batch_id: number;
  container_id: number | null;
  cell_index: number | null;
  number: number;
  status: 'seedling' | 'growing' | 'transplanted' | 'harvested' | 'dead';
  notes: string | null;
  created_at: string;
  updated_at: string;
  // джойны, приходят из API
  species?: string;
  variety?: string | null;
  sowing_date?: string;
  container_name?: string | null;
  container_type?: string | null;
}

export interface PlantEvent {
  id: number;
  plant_id: number;
  event_type: 'transplant' | 'note' | 'measure' | 'water';
  event_date: string;
  from_container_id: number | null;
  from_cell_index: number | null;
  to_container_id: number | null;
  to_cell_index: number | null;
  notes: string | null;
  from_container_name?: string | null;
  to_container_name?: string | null;
}

export const PLANT_STATUS_LABELS: Record<Plant['status'], string> = {
  seedling: 'Сеянец',
  growing: 'Растёт',
  transplanted: 'Пикировано',
  harvested: 'Собрано',
  dead: 'Погибло',
};