import { useState } from 'react';
import { useZoneStore } from '../store/useZoneStore';
import { useContainerStore } from '../store/useContainerStore';
import {
  ZONE_CONTAINER_TYPES,
  type Container,
  type ContainerType,
} from '../types';

export type ContainerFormData = {
  name: string;
  type: ContainerType;
  width: number;
  height: number;
  cols: number | null;
  rows: number | null;
  zone_id: number | null;
};

interface ContainerFormProps {
  initial?: Partial<Container>;
  onSubmit: (data: ContainerFormData) => void;
  onCancel: () => void;
  submitLabel: string;
}

// Типы контейнеров, которые можно создать в UI
const ALL_TYPE_OPTIONS: { value: ContainerType; label: string }[] = [
  { value: 'pot', label: 'Горшок' },
  { value: 'tray', label: 'Кассета' },
  { value: 'bed', label: 'Грядка' },
];

// Русские названия для дефолтных имён
// (без greenhouse — тип больше не используется для контейнеров)
const TYPE_NAMES: Record<string, string> = {
  pot: 'Горшок',
  tray: 'Кассета',
  bed: 'Грядка',
};

// Дефолтные размеры в см
const TYPE_DEFAULTS_CM: Record<string, { width: number; height: number }> = {
  pot: { width: 5, height: 5 },
  tray: { width: 30, height: 20 },
  bed: { width: 300, height: 200 },
};

// Следующий номер для типа в текущей зоне
function getNextNumber(
  containers: Container[],
  zoneId: number | null,
  type: ContainerType
): number {
  const typeName = TYPE_NAMES[type] ?? type;
  const prefix = typeName + ' ';

  let max = 0;
  for (const c of containers) {
    if (c.zone_id !== zoneId) continue;
    if (c.type !== type) continue;
    if (c.name.startsWith(prefix)) {
      const n = parseInt(c.name.slice(prefix.length), 10);
      if (!isNaN(n) && n > max) max = n;
    }
  }
  return max + 1;
}

export function ContainerForm({ initial, onSubmit, onCancel, submitLabel }: ContainerFormProps) {
  const zones = useZoneStore((s) => s.zones);
  const currentZone = useZoneStore((s) => s.currentZone);
  const allContainers = useContainerStore((s) => s.containers);

  const isEdit = !!initial?.id;

  // Зона контейнера (для пересчёта см → px)
  const containerZoneId = initial?.zone_id ?? currentZone?.id ?? null;
  const containerZone = zones.find((z) => z.id === containerZoneId);
  const containerPxPerCm = containerZone?.px_per_cm ?? 10;

  // Тип целевой зоны — определяет доступные типы контейнеров
  const initialType: ContainerType = initial?.type ?? 'pot';
  const [zoneId, setZoneId] = useState<number | null>(containerZoneId);

  const targetZoneForTypes = zones.find((z) => z.id === zoneId);
  const zoneType = targetZoneForTypes?.type ?? currentZone?.type ?? 'surface';

  const allowedTypes = ZONE_CONTAINER_TYPES[zoneType] ?? ['pot', 'tray'];
  const visibleTypeOptions = ALL_TYPE_OPTIONS.filter((o) =>
    allowedTypes.includes(o.value)
  );

  // ===== Дефолтное имя =====
  const defaultName = isEdit
    ? (initial?.name ?? '')
    : `${TYPE_NAMES[initialType] ?? initialType} ${getNextNumber(
        allContainers,
        containerZoneId,
        initialType
      )}`;

  const [name, setName] = useState(defaultName);
  const [type, setType] = useState<ContainerType>(initialType);

  const initialDefaults = TYPE_DEFAULTS_CM[initialType] ?? TYPE_DEFAULTS_CM.pot;

  const [widthCm, setWidthCm] = useState(
    initial?.width
      ? Math.round(initial.width / containerPxPerCm)
      : initialDefaults.width
  );
  const [heightCm, setHeightCm] = useState(
    initial?.height
      ? Math.round(initial.height / containerPxPerCm)
      : initialDefaults.height
  );

  const [cols, setCols] = useState<string>(initial?.cols?.toString() ?? '');
  const [rows, setRows] = useState<string>(initial?.rows?.toString() ?? '');

  const handleTypeChange = (newType: ContainerType) => {
    setType(newType);
    const defaults = TYPE_DEFAULTS_CM[newType] ?? TYPE_DEFAULTS_CM.pot;
    setWidthCm(defaults.width);
    setHeightCm(defaults.height);

    // Если пользователь не менял имя вручную — обновляем под новый тип
    if (!isEdit) {
      const currentDefault = `${TYPE_NAMES[type] ?? type} ${getNextNumber(
        allContainers,
        containerZoneId,
        type
      )}`;
      if (name === currentDefault) {
        setName(
          `${TYPE_NAMES[newType] ?? newType} ${getNextNumber(
            allContainers,
            containerZoneId,
            newType
          )}`
        );
      }
    }
  };

  const handleZoneChange = (newZoneId: number | null) => {
    setZoneId(newZoneId);
    if (newZoneId == null) return;

    const targetZone = zones.find((z) => z.id === newZoneId);
    if (!targetZone) return;

    if (type === 'bed') return;

    const allowed = ZONE_CONTAINER_TYPES[targetZone.type] ?? ['pot', 'tray'];

    if (!allowed.includes(type)) {
      const fallback = allowed[0];
      setType(fallback);

      const defaults = TYPE_DEFAULTS_CM[fallback] ?? TYPE_DEFAULTS_CM.pot;
      setWidthCm(defaults.width);
      setHeightCm(defaults.height);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const targetZone = zones.find((z) => z.id === zoneId);
    const targetPxPerCm = targetZone?.px_per_cm ?? containerPxPerCm;

    onSubmit({
      name: name.trim(),
      type,
      width: Math.round(widthCm * targetPxPerCm),
      height: Math.round(heightCm * targetPxPerCm),
      cols: cols ? Number(cols) : null,
      rows: rows ? Number(rows) : null,
      zone_id: zoneId,
    });
  };

  const showGrid = type === 'tray' || type === 'bed';
  const isBed = type === 'bed';
  const zoneChanged = zoneId !== containerZoneId;

  return (
    <form className="container-form" onSubmit={handleSubmit}>
      <label className="field">
        <span>Название</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onFocus={(e) => {
            // Ставим курсор в конец — удобно дописывать
            const len = e.target.value.length;
            e.target.setSelectionRange(len, len);
          }}
          placeholder="Например, Плошка №1"
          autoFocus
        />
      </label>

      {isEdit && type !== 'bed' && (
        <label className="field">
          <span>Зона</span>
          <select
            value={zoneId == null ? '' : String(zoneId)}
            onChange={(e) => {
              const val = e.target.value;
              handleZoneChange(val ? Number(val) : null);
            }}
          >
            <option value="">— не выбрана —</option>
            {zones.map((z) => (
              <option key={z.id} value={String(z.id)}>
                {z.name}
              </option>
            ))}
          </select>
          {zoneChanged && (
            <span className="field-hint">
              Контейнер переедет в левый верхний угол новой зоны.
            </span>
          )}
        </label>
      )}

      {/* Тип — только при создании */}
      {!isEdit ? (
        <label className="field">
          <span>Тип</span>
          <select
            value={type}
            onChange={(e) => handleTypeChange(e.target.value as ContainerType)}
          >
            {visibleTypeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
      ) : (
        <div className="field-readonly-block">
          <span className="field-readonly-label">Тип:</span>
          <span className="field-readonly-value">
            {TYPE_NAMES[type] ?? type}
          </span>
        </div>
      )}

      {isBed ? (
        <div className="field-row">
          <label className="field">
            <span>Длина (м)</span>
            <input
              type="number"
              min={0.5}
              max={50}
              step={0.5}
              value={+(widthCm / 100).toFixed(1)}
              onChange={(e) => {
                const m = Number(e.target.value);
                setWidthCm(Math.max(50, Math.round(m * 100)));
              }}
              className="field-narrow"
            />
          </label>
          <label className="field">
            <span>Ширина (м)</span>
            <input
              type="number"
              min={0.5}
              max={50}
              step={0.5}
              value={+(heightCm / 100).toFixed(1)}
              onChange={(e) => {
                const m = Number(e.target.value);
                setHeightCm(Math.max(50, Math.round(m * 100)));
              }}
              className="field-narrow"
            />
          </label>
        </div>
      ) : (
        <div className="field-row">
          <label className="field">
            <span>Длина (см)</span>
            <input
              type="number"
              min={1}
              max={999}
              step={1}
              value={widthCm}
              onChange={(e) => setWidthCm(Number(e.target.value))}
              className="field-narrow"
            />
          </label>
          <label className="field">
            <span>Ширина (см)</span>
            <input
              type="number"
              min={1}
              max={999}
              step={1}
              value={heightCm}
              onChange={(e) => setHeightCm(Number(e.target.value))}
              className="field-narrow"
            />
          </label>
        </div>
      )}

      {showGrid && (
        <div className="field-row">
          <label className="field">
            <span>Колонок</span>
            <input
              type="number"
              min={1}
              max={9999}
              value={cols}
              onChange={(e) => setCols(e.target.value)}
              placeholder="—"
              className="field-narrow"
            />
          </label>
          <label className="field">
            <span>Рядов</span>
            <input
              type="number"
              min={1}
              max={9999}
              value={rows}
              onChange={(e) => setRows(e.target.value)}
              placeholder="—"
              className="field-narrow"
            />
          </label>
        </div>
      )}

      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Отмена
        </button>
        <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}