import { useState } from 'react';
import type { Container } from '../types';

export type ContainerFormData = {
  name: string;
  type: Container['type'];
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

// Типы контейнеров (без теплицы — она теперь отдельная зона)
const TYPE_OPTIONS: { value: Container['type']; label: string }[] = [
  { value: 'pot', label: 'Горшок' },
  { value: 'tray', label: 'Кассета' },
  { value: 'bed', label: 'Грядка' },
];

// Дефолтные размеры в см по типу контейнера
const TYPE_DEFAULTS: Record<string, { width: number; height: number }> = {
  pot: { width: 5, height: 5 },
  tray: { width: 30, height: 20 },
  bed: { width: 300, height: 100 },
  greenhouse: { width: 300, height: 100 },
};

// Единый масштаб: 1 см = 10 px
const PX_PER_CM = 10;

const pxToCm = (px: number) => Math.round(px / PX_PER_CM);
const cmToPx = (cm: number) => Math.round(cm * PX_PER_CM);

export function ContainerForm({ initial, onSubmit, onCancel, submitLabel }: ContainerFormProps) {
  const initialType = initial?.type ?? 'pot';
  const initialDefaults = TYPE_DEFAULTS[initialType] ?? TYPE_DEFAULTS.pot;

  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState<Container['type']>(initialType);

  const [widthCm, setWidthCm] = useState(
    initial?.width ? pxToCm(initial.width) : initialDefaults.width
  );
  const [heightCm, setHeightCm] = useState(
    initial?.height ? pxToCm(initial.height) : initialDefaults.height
  );

  const [cols, setCols] = useState<string>(initial?.cols?.toString() ?? '');
  const [rows, setRows] = useState<string>(initial?.rows?.toString() ?? '');

  // При смене типа подставляем дефолтные размеры
  const handleTypeChange = (newType: Container['type']) => {
    setType(newType);
    const defaults = TYPE_DEFAULTS[newType] ?? TYPE_DEFAULTS.pot;
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
          onChange={(e) => handleTypeChange(e.target.value as Container['type'])}
        >
          {TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </label>

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