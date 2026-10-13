import { useEffect, useState } from 'react';
import { useZoneStore } from '../store/useZoneStore';
import { zonesApi } from '../api/zones';
import {
  ZONE_TYPE_LABELS,
  ZONE_TYPE_EMOJI,
  ZONE_TYPE_DESCRIPTIONS,
  ZONE_DEFAULTS,
  type ZoneType,
} from '../types';

interface ZoneModalProps {
  mode: 'create' | 'edit';
  zoneId?: number;
  onClose: () => void;
}

const ZONE_TYPES: ZoneType[] = ['shelf', 'surface', 'garden'];

export function ZoneModal({ mode, zoneId, onClose }: ZoneModalProps) {
  const createZone = useZoneStore((s) => s.createZone);
  const updateZone = useZoneStore((s) => s.updateZone);
  const removeZone = useZoneStore((s) => s.removeZone);

  const [name, setName] = useState('');
  const [type, setType] = useState<ZoneType>('surface');
  const [loading, setLoading] = useState(false);

  const [widthCm, setWidthCm] = useState(ZONE_DEFAULTS.surface.widthCm);
  const [depthCm, setDepthCm] = useState(ZONE_DEFAULTS.surface.depthCm);
  const [shelfCount, setShelfCount] = useState(4);

  useEffect(() => {
    if (mode === 'edit' && zoneId) {
      zonesApi.getOne(zoneId).then((data) => {
        setName(data.name);
        setType(data.type);
        if (data.width_cm) setWidthCm(data.width_cm);
        if (data.depth_cm) setDepthCm(data.depth_cm);
        if (data.shelf_count) setShelfCount(data.shelf_count);
      });
    }
  }, [mode, zoneId]);

  // При смене типа — подставляем дефолтные размеры
  const handleTypeChange = (newType: ZoneType) => {
    setType(newType);
    const d = ZONE_DEFAULTS[newType];
    setWidthCm(d.widthCm);
    setDepthCm(d.depthCm);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    const defaults = ZONE_DEFAULTS[type];

    const payload = {
      name: name.trim(),
      type,
      background_color: defaults.bg,
      grid_size: 20,
      width_cm: widthCm,
      depth_cm: depthCm,
      shelf_count: type === 'shelf' ? shelfCount : undefined,
    };

    let ok = false;
    if (mode === 'create') {
      const created = await createZone(payload as Parameters<typeof createZone>[0]);
      ok = !!created;
    } else if (zoneId) {
      ok = await updateZone(zoneId, payload as Parameters<typeof updateZone>[1]);
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
          <h3>{mode === 'create' ? 'Новая зона' : 'Настройки зоны'}</h3>
          <button className="btn-icon" onClick={onClose} aria-label="Закрыть">×</button>
        </div>

        <form className="zone-form" onSubmit={handleSubmit}>
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
                  <span className="zone-type-desc">{ZONE_TYPE_DESCRIPTIONS[t]}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="zone-config">
            <div className="zone-config-title">
              {type === 'shelf' && 'Параметры стеллажа'}
              {type === 'surface' && 'Размеры поверхности'}
              {type === 'garden' && 'Размеры огорода'}
            </div>

            {type === 'shelf' ? (
              <>
                <div className="zone-fields">
                  <label className="field field-shelf">
                    <span>Ширина полки (см)</span>
                    <input
                      type="number"
                      min={20}
                      max={500}
                      value={widthCm}
                      onChange={(e) => setWidthCm(Number(e.target.value))}
                    />
                  </label>
                  <label className="field field-shelf">
                    <span>Глубина полки (см)</span>
                    <input
                      type="number"
                      min={10}
                      max={200}
                      value={depthCm}
                      onChange={(e) => setDepthCm(Number(e.target.value))}
                    />
                  </label>
                  <label className="field field-shelf">
                    <span>Полок</span>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={shelfCount}
                      onChange={(e) => setShelfCount(Number(e.target.value))}
                    />
                  </label>
                </div>

                <div className="shelf-preview">
                  <div className="shelf-preview-label">
                    {widthCm}×{depthCm} см · {shelfCount} полок
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
              </>
            ) : type === 'surface' ? (
              <div className="zone-fields zone-fields-2">
                <label className="field field-shelf">
                  <span>Ширина (см)</span>
                  <input
                    type="number"
                    min={10}
                    max={2000}
                    value={widthCm}
                    onChange={(e) => setWidthCm(Number(e.target.value))}
                  />
                </label>
                <label className="field field-shelf">
                  <span>Глубина (см)</span>
                  <input
                    type="number"
                    min={10}
                    max={2000}
                    value={depthCm}
                    onChange={(e) => setDepthCm(Number(e.target.value))}
                  />
                </label>
              </div>
            ) : (
              <>
                <div className="zone-fields zone-fields-2">
                  <label className="field field-shelf">
                    <span>Ширина (м)</span>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      step={0.5}
                      value={+(widthCm / 100).toFixed(2)}
                      onChange={(e) => {
                        const meters = Number(e.target.value);
                        setWidthCm(Math.max(100, Math.round(meters * 100)));
                      }}
                    />
                  </label>
                  <label className="field field-shelf">
                    <span>Длина (м)</span>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      step={0.5}
                      value={+(depthCm / 100).toFixed(2)}
                      onChange={(e) => {
                        const meters = Number(e.target.value);
                        setDepthCm(Math.max(100, Math.round(meters * 100)));
                      }}
                    />
                  </label>
                </div>

                <div className="zone-config-hint">
                  {+(widthCm / 100).toFixed(2)} × {+(depthCm / 100).toFixed(2)} м
                </div>
              </>
            )}

            <div className="zone-config-hint">
              {type === 'shelf' && 'Полки рисуются сверху вниз. Каждая полка — отдельная горизонтальная полоса.'}
              {type === 'surface' && 'Плоская поверхность: подоконник, стол, балкон.'}
              {type === 'garden' && 'Масштаб меньше — влезают большие грядки. Доступны грядки как тип контейнера.'}
            </div>
          </div>

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