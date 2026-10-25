// ===== Контейнеры =====
export type ContainerType = 'pot' | 'tray' | 'bed';

export interface Container {
  id: number;
  user_id: number;
  zone_id: number | null;
  name: string;
  type: ContainerType;
  x: number;
  y: number;
  width: number;
  height: number;
  cols: number | null;
  rows: number | null;
  created_at: string;
  updated_at: string;
}

// ===== Зоны =====
export type ZoneType = 'shelf' | 'surface' | 'garden';

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
  width_cm: number | null;
  depth_cm: number | null;
  shelf_count: number | null;
}

export const ZONE_TYPE_LABELS: Record<ZoneType, string> = {
  shelf: 'Стеллаж',
  surface: 'Поверхность',
  garden: 'Огород',
};

export const ZONE_TYPE_EMOJI: Record<ZoneType, string> = {
  shelf: '🗄️',
  surface: '🪟',
  garden: '🌾',
};

export const ZONE_TYPE_DESCRIPTIONS: Record<ZoneType, string> = {
  shelf: 'Полки для горшков и кассет',
  surface: 'Подоконник, стол, балкон',
  garden: 'Грядки на открытом грунте',
};

export const ZONE_DEFAULTS: Record<ZoneType, {
  widthCm: number;
  depthCm: number;
  pxPerCm: number;
  bg: string;
}> = {
  shelf:   { widthCm: 80,  depthCm: 30,  pxPerCm: 10, bg: '#f5f0e6' },
  surface: { widthCm: 120, depthCm: 40,  pxPerCm: 10, bg: '#faf6ef' },
  garden:  { widthCm: 600, depthCm: 400, pxPerCm: 2,  bg: '#e8f0e0' },
};

export const ZONE_CONTAINER_TYPES: Record<ZoneType, ContainerType[]> = {
  shelf:   ['pot', 'tray'],
  surface: ['pot', 'tray'],
  garden:  ['pot', 'tray', 'bed'],
};

// ===== Партии =====
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

// ===== Растения =====
export type PlantStatus = 'sown' | 'growing' | 'flowering' | 'fruiting' | 'done';

export interface Plant {
  id: number;
  batch_id: number;
  container_id: number | null;
  cell_index: number | null;
  number: number;
  display_number: number | null;
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
  from_zone_name?: string | null;
  to_zone_name?: string | null; 
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

// ===== Статистика =====
export interface StatsTotals {
  plants: number;
  batches: number;
  containers: number;
  zones: number;
  total_seeds: number;
  orphans: number;
  avg_age_days: number | null;
  byStatus: Record<PlantStatus, number>;
}

export interface SpeciesStats {
  species: string;
  variety: string;
  seeds: number;
  batches: number;
  plants: number;
  germinated: number;
  rate: number;
}

export interface ZoneStats {
  id: number;
  name: string;
  type: ZoneType;
  containers: number;
  plants: number;
}

export interface MonthStats {
  month: string; // 'YYYY-MM'
  batches: number;
  seeds: number;
}

export interface ContainerStats {
  id: number;
  name: string;
  type: ContainerType;
  zone_name: string | null;
  plants: number;
}

export interface Stats {
  totals: StatsTotals;
  bySpecies: SpeciesStats[];
  bySpeciesLocation: SpeciesLocationStats[];
  byZone: ZoneStats[];
  byMonth: MonthStats[];
  topContainers: ContainerStats[];
}

export interface SpeciesLocation {
  zone_id: number | null;
  zone_name: string | null;
  container_id: number | null;
  container_name: string | null;
  status_counts: Partial<Record<PlantStatus, number>>;
  total: number;
}

export interface SpeciesLocationStats {
  species: string;
  variety: string;
  total: number;
  locations: SpeciesLocation[];
}