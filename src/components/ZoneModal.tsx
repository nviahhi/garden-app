import { useEffect, useState } from 'react';
import { useZoneStore } from '../store/useZoneStore';
import { zonesApi } from '../api/zones';
import {
  ZONE_TYPE_LABELS,
  ZONE_TYPE_EMOJI,
  ZONE_DEFAULTS,
  type ZoneType,
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
  const [loading, setLoading] = useState(false);

  const [shelfWidthCm, setShelfWidthCm] = useState(80);
  const [shelfDepthCm, setShelfDepthCm] = useState(30);
  const [shelfCount, setShelfCount] = useState(4);

  useEffect(() => {
    if (mode === 'edit' && zoneId) {
      zonesApi.getOne(zoneId).then((data) => {
        setName(data.name);
        setType(data.type);
        if (data.shelf_width_cm) setShelfWidthCm(data.shelf_width_cm);
        if (data.shelf_depth_cm) setShelfDepthCm(data.shelf_depth_cm);
        if (data.shelf_count) setShelfCount(data.shelf_count);
      });
    }
  }, [mode, zoneId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    const defaults = ZONE_DEFAULTS[type];

    let payload: Parameters<typeof createZone>[0] = {
      name: name.trim(),
      type,
    };

    if (type === 'shelf') {
      payload = {
        ...payload,
        background_color: defaults.bg,
        grid_size: 20,
        shelf_width_cm: shelfWidthCm,
        shelf_depth_cm: shelfDepthCm,
        shelf_count: shelfCount,
      };
      // canvas_width и canvas_height вычисляются на backend
    } else {
      payload = {
        ...payload,
        canvas_width: defaults.width,
        canvas_height: defaults.height,
        px_per_cm: defaults.pxPerCm,
        background_color: defaults.bg,
        grid_size: 20,
      };
    }

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

        <form className="zone-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Название *</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например, Стеллаж у окна"
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
                  onClick={() => setType(t)}
                >
                  <span className="zone-type-emoji">{ZONE_TYPE_EMOJI[t]}</span>
                  <span className="zone-type-label">{ZONE_TYPE_LABELS[t]}</span>
                </button>
              ))}
            </div>
          </div>

          {type === 'shelf' && (
            <div className="shelf-config">
              <div className="shelf-config-title">Параметры стеллажа</div>

              <div className="shelf-fields">
                <label className="field field-shelf">
                  <span>Ширина (см)</span>
                  <input
                    type="number"
                    min={20}
                    max={500}
                    step={1}
                    value={shelfWidthCm}
                    onChange={(e) => setShelfWidthCm(Number(e.target.value))}
                  />
                </label>

                <label className="field field-shelf">
                  <span>Глубина (см)</span>
                  <input
                    type="number"
                    min={10}
                    max={200}
                    step={1}
                    value={shelfDepthCm}
                    onChange={(e) => setShelfDepthCm(Number(e.target.value))}
                  />
                </label>

                <label className="field field-shelf">
                  <span>Полок</span>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    step={1}
                    value={shelfCount}
                    onChange={(e) => setShelfCount(Number(e.target.value))}
                  />
                </label>
              </div>

              <div className="shelf-preview">
                <div className="shelf-preview-label">
                  Превью · {shelfWidthCm}×{shelfDepthCm} см · {shelfCount} полок
                </div>
                <div className="shelf-preview-canvas">
                  {Array.from({ length: shelfCount }).map((_, i) => (
                    <div key={i} className="shelf-preview-row">
                      <span className="shelf-preview-name">
                        Полка {shelfCount - i}
                      </span>
                    </div>
                  ))}
                </div>
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