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

const TYPE_OPTIONS: { value: Container['type']; label: string }[] = [
  { value: 'pot', label: 'Горшок' },
  { value: 'tray', label: 'Кассета' },
  { value: 'bed', label: 'Грядка' },
  { value: 'greenhouse', label: 'Теплица' },
];

// 1 см = 20 px (соответствует размеру клетки сетки)
const PX_PER_CM = 20;

const pxToCm = (px: number) => Math.round((px / PX_PER_CM) * 10) / 10;
const cmToPx = (cm: number) => Math.round(cm * PX_PER_CM);

export function ContainerForm({ initial, onSubmit, onCancel, submitLabel }: ContainerFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState<Container['type']>(initial?.type ?? 'pot');

  // Показываем в см, но внутри формы держим см до отправки
  const [widthCm, setWidthCm] = useState(pxToCm(initial?.width ?? 80));
  const [heightCm, setHeightCm] = useState(pxToCm(initial?.height ?? 40));

  const [cols, setCols] = useState<string>(initial?.cols?.toString() ?? '');
  const [rows, setRows] = useState<string>(initial?.rows?.toString() ?? '');

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

  const showGrid = type === 'tray' || type === 'bed' || type === 'greenhouse';

  return (
    <form className="container-form" onSubmit={handleSubmit}>
      <label className="field">
        <span>Название</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Например, Кассета №1"
          autoFocus
        />
      </label>

      <label className="field">
        <span>Тип</span>
        <select value={type} onChange={(e) => setType(e.target.value as Container['type'])}>
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
            min={2}
            max={500}
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
            min={2}
            max={500}
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