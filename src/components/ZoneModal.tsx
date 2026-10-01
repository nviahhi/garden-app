import { useEffect, useState } from 'react';
import { useZoneStore } from '../store/useZoneStore';
import { zonesApi } from '../api/zones';
import {
  ZONE_TYPE_LABELS,
  ZONE_TYPE_EMOJI,
  ZONE_DEFAULTS,
  type ZoneType,
  type ZoneShelf,
} from '../types';

interface ZoneModalProps {
  mode: 'create' | 'edit';
  zoneId?: number;
  onClose: () => void;
}

const ZONE_TYPES: ZoneType[] = ['windowsill', 'shelf', 'balcony', 'greenhouse', 'garden'];

export function ZoneModal({ mode, zoneId, onClose }: ZoneModalProps) {
  const createZone = useZoneStore((s) => s.createZone);
  const updateZone = useZoneStore((s) => s.updateZone);
  const removeZone = useZoneStore((s) => s.removeZone);

  const [name, setName] = useState('');
  const [type, setType] = useState<ZoneType>('windowsill');
  const [shelves, setShelves] = useState<Partial<ZoneShelf>[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (mode === 'edit' && zoneId) {
      zonesApi.getOne(zoneId).then((data) => {
        setName(data.name);
        setType(data.type);
        setShelves(data.shelves ?? []);
      });
    }
  }, [mode, zoneId]);

  const handleTypeChange = (newType: ZoneType) => {
    setType(newType);
    if (newType === 'shelf' && shelves.length === 0) {
      setShelves([
        { name: 'Полка 3', y: 100, height: 200 },
        { name: 'Полка 2', y: 350, height: 200 },
        { name: 'Полка 1', y: 600, height: 200 },
      ]);
    }
  };

  const addShelf = () => {
    const lastY = shelves.length > 0
      ? Math.max(...shelves.map((s) => s.y ?? 0))
      : 0;
    setShelves([
      ...shelves,
      { name: `Полка ${shelves.length + 1}`, y: lastY + 220, height: 200 },
    ]);
  };

  const updateShelfField = (index: number, field: string, value: string | number) => {
    setShelves(shelves.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  };

  const removeShelf = (index: number) => {
    setShelves(shelves.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    const defaults = ZONE_DEFAULTS[type];

    const payload = {
      name: name.trim(),
      type,
      canvas_width: defaults.width,
      canvas_height: defaults.height,
      px_per_cm: defaults.pxPerCm,
      background_color: defaults.bg,
      shelves: type === 'shelf' ? shelves : undefined,
    };

    let ok = false;
    if (mode === 'create') {
      const created = await createZone(payload);
      ok = !!created;
    } else if (zoneId) {
      ok = await updateZone(zoneId, payload);
    }

    setLoading(false);
    if (ok) onClose();
  };

  const handleDelete = async () => {
    if (!zoneId) return;
    if (confirm(`Удалить зону «${name}»? Все контейнеры в ней будут удалены.`)) {
      const ok = await removeZone(zoneId);
      if (ok) onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="panel-header">
          <h3>{mode === 'create' ? 'Новая зона' : 'Редактировать зону'}</h3>
          <button className="btn-icon" onClick={onClose} aria-label="Закрыть">×</button>
        </div>

        <form className="container-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Название *</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например, Подоконник на кухне"
              autoFocus
            />
          </label>

          <div className="field">
            <span>Тип зоны</span>
            <div className="zone-type-grid">
              {ZONE_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`zone-type-btn ${type === t ? 'is-active' : ''}`}
                  onClick={() => handleTypeChange(t)}
                >
                  <span className="zone-type-emoji">{ZONE_TYPE_EMOJI[t]}</span>
                  <span className="zone-type-label">{ZONE_TYPE_LABELS[t]}</span>
                </button>
              ))}
            </div>
          </div>

          {type === 'shelf' && (
            <div className="field">
              <span>Полки</span>
              <div className="shelves-editor">
                {shelves.map((s, i) => (
                  <div key={i} className="shelf-row">
                    <input
                      type="text"
                      value={s.name ?? ''}
                      onChange={(e) => updateShelfField(i, 'name', e.target.value)}
                      placeholder={`Полка ${i + 1}`}
                      className="shelf-name-input"
                    />
                    <input
                      type="number"
                      value={s.y ?? 0}
                      onChange={(e) => updateShelfField(i, 'y', Number(e.target.value))}
                      title="Верхняя граница (px)"
                      className="field-narrow"
                    />
                    <input
                      type="number"
                      value={s.height ?? 200}
                      onChange={(e) => updateShelfField(i, 'height', Number(e.target.value))}
                      title="Высота (px)"
                      className="field-narrow"
                    />
                    <button
                      type="button"
                      className="btn-icon-sm"
                      onClick={() => removeShelf(i)}
                      title="Удалить"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button type="button" className="btn btn-ghost btn-block" onClick={addShelf}>
                  + Добавить полку
                </button>
              </div>
            </div>
          )}

          <div className="form-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              disabled={loading}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!name.trim() || loading}
            >
              {loading ? 'Сохраняю...' : mode === 'create' ? 'Создать' : 'Сохранить'}
            </button>
          </div>

          {mode === 'edit' && (
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleDelete}
              disabled={loading}
            >
              Удалить зону
            </button>
          )}
        </form>
      </div>
    </div>
  );
}