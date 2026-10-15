import { useState } from 'react';
import { useZoneStore } from '../store/useZoneStore';
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

const ALL_TYPE_OPTIONS: { value: ContainerType; label: string }[] = [
  { value: 'pot', label: 'Горшок' },
  { value: 'tray', label: 'Кассета' },
  { value: 'bed', label: 'Грядка' },
];

const TYPE_LABELS: Record<ContainerType, string> = {
  pot: 'Горшок',
  tray: 'Кассета',
  bed: 'Грядка'
};

const TYPE_DEFAULTS_CM: Record<ContainerType, { width: number; height: number }> = {
  pot: { width: 5, height: 5 },
  tray: { width: 30, height: 20 },
  bed: { width: 300, height: 200 }
};

export function ContainerForm({ initial, onSubmit, onCancel, submitLabel }: ContainerFormProps) {
  const zones = useZoneStore((s) => s.zones);
  const currentZone = useZoneStore((s) => s.currentZone);

  const isEdit = !!initial?.id;

  const containerZoneId = initial?.zone_id ?? currentZone?.id ?? null;
  const containerZone = zones.find((z) => z.id === containerZoneId);
  const containerPxPerCm = containerZone?.px_per_cm ?? 10;

  const [zoneId, setZoneId] = useState<number | null>(containerZoneId);
  const [name, setName] = useState(initial?.name ?? '');

  const targetZoneForTypes = zones.find((z) => z.id === zoneId);
  const zoneType = targetZoneForTypes?.type ?? currentZone?.type ?? 'surface';

  const allowedTypes = ZONE_CONTAINER_TYPES[zoneType] ?? ['pot', 'tray'];
  const initialType = initial?.type ?? allowedTypes[0];

  const visibleTypeOptions = ALL_TYPE_OPTIONS.filter((o) =>
    allowedTypes.includes(o.value)
  );

  const initialDefaults = TYPE_DEFAULTS_CM[initialType];
  const [type, setType] = useState<ContainerType>(initialType);

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
    const defaults = TYPE_DEFAULTS_CM[newType];
    setWidthCm(defaults.width);
    setHeightCm(defaults.height);
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

      const defaults = TYPE_DEFAULTS_CM[fallback];
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
          <span className="field-readonly-value">{TYPE_LABELS[type]}</span>
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