export interface Container {
  id: number;
  user_id: number;
  zone_id: number | null;
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
  display_number: number | null;   // ← новое
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
  event_type: 'transplant' | 'note' | 'measure' | 'water' | 'status_change';  
  event_date: string;
  from_container_id: number | null;
  from_cell_index: number | null;
  to_container_id: number | null;
  to_cell_index: number | null;
  from_status: string | null;
  to_status: string | null;
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

export type ZoneType =
  | 'windowsill'
  | 'shelf'
  | 'balcony'
  | 'greenhouse'
  | 'garden';

export interface ZoneShelf {
  id: number;
  zone_id: number;
  name: string;
  y: number;
  height: number;
  color: string;
  sort_order: number;
}

export interface Zone {
  id: number;
  user_id: number;
  name: string;
  type: ZoneType;
  canvas_width: number;
  canvas_height: number;
  px_per_cm: number;
  background_color: string;
  grid_size: number;
  sort_order: number;
  created_at: string;
  containers_count?: number;
  shelves?: ZoneShelf[];
}

export const ZONE_TYPE_LABELS: Record<ZoneType, string> = {
  windowsill: 'Подоконник',
  shelf: 'Стеллаж',
  balcony: 'Балкон',
  greenhouse: 'Теплица',
  garden: 'Огород',
};

export const ZONE_TYPE_EMOJI: Record<ZoneType, string> = {
  windowsill: '🪟',
  shelf: '🗄️',
  balcony: '🌇',
  greenhouse: '🏡',
  garden: '🌾',
};

// Дефолты для создания зоны
export const ZONE_DEFAULTS: Record<ZoneType, {
  width: number;
  height: number;
  pxPerCm: number;
  bg: string;
}> = {
  windowsill: { width: 1200, height: 400, pxPerCm: 20, bg: '#faf6ef' },
  shelf:      { width: 1000, height: 900, pxPerCm: 20, bg: '#f5f0e6' },
  balcony:    { width: 1600, height: 800, pxPerCm: 10, bg: '#f0f5f0' },
  greenhouse: { width: 1600, height: 1000, pxPerCm: 10, bg: '#eef5ee' },
  garden:     { width: 2400, height: 1600, pxPerCm: 2, bg: '#e8f0e0' },
};
