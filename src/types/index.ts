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
  container_name?: string | null;
  container_type?: string | null;
}

export type PlantStatus =
  | 'sown'
  | 'growing'
  | 'flowering'
  | 'fruiting'
  | 'done';

export interface Plant {
  id: number;
  batch_id: number;
  container_id: number | null;
  cell_index: number | null;
  number: number;
  status: PlantStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  species?: string;
  variety?: string | null;
  sowing_date?: string;
  container_name?: string | null;
  container_type?: string | null;
  events?: PlantEvent[];
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

export const PLANT_STATUS_LABELS: Record<PlantStatus, string> = {
  sown: 'Посеяно',
  growing: 'Растёт',
  flowering: 'Цветёт',
  fruiting: 'Плодоносит',
  done: 'Завершено',
};

export const PLANT_STATUS_EMOJI: Record<PlantStatus, string> = {
  sown: '🌰',
  growing: '🌱',
  flowering: '🌸',
  fruiting: '🍅',
  done: '✅',
};

export const PLANT_STATUS_COLORS: Record<PlantStatus, string> = {
  sown: '#d7ccc8',
  growing: '#a5d6a7',
  flowering: '#f8bbd0',
  fruiting: '#ffcc80',
  done: '#90a4ae',
};