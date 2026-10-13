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

// Дефолтные размеры в см
const TYPE_DEFAULTS_CM: Record<ContainerType, { width: number; height: number }> = {
  pot: { width: 5, height: 5 },        // 5×5 см
  tray: { width: 30, height: 20 },      // 30×20 см
  bed: { width: 300, height: 200 }     // 3×2 м
};

export function ContainerForm({ initial, onSubmit, onCancel, submitLabel }: ContainerFormProps) {
  const currentZone = useZoneStore((s) => s.currentZone);
  const zoneType = currentZone?.type ?? 'surface';
  const pxPerCm = currentZone?.px_per_cm ?? 10;

  const pxToCm = (px: number) => Math.round(px / pxPerCm);
  const cmToPx = (cm: number) => Math.round(cm * pxPerCm);

  const allowedTypes = ZONE_CONTAINER_TYPES[zoneType] ?? ['pot', 'tray'];
  const initialType = initial?.type ?? allowedTypes[0];

  const visibleTypeOptions = ALL_TYPE_OPTIONS.filter(
    (o) => allowedTypes.includes(o.value) || o.value === initialType
  );

  const initialDefaults = TYPE_DEFAULTS_CM[initialType];

  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState<ContainerType>(initialType);

  const [widthCm, setWidthCm] = useState(
    initial?.width ? pxToCm(initial.width) : initialDefaults.width
  );
  const [heightCm, setHeightCm] = useState(
    initial?.height ? pxToCm(initial.height) : initialDefaults.height
  );

  const [cols, setCols] = useState<string>(initial?.cols?.toString() ?? '');
  const [rows, setRows] = useState<string>(initial?.rows?.toString() ?? '');

  const handleTypeChange = (newType: ContainerType) => {
    setType(newType);
    const defaults = TYPE_DEFAULTS_CM[newType];
    setWidthCm(defaults.width);
    setHeightCm(defaults.height);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      type,
      width: cmToPx(widthCm),
      height: cmToPx(heightCm),
      cols: cols ? Number(cols) : null,
      rows: rows ? Number(rows) : null,
    });
  };

  const showGrid = type === 'tray' || type === 'bed';
  const isBed = type === 'bed';

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

      {isBed ? (
        // ГРЯДКА — в метрах
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
        // ОСТАЛЬНОЕ — в см
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