import { useEffect, useState } from 'react';
import { statsApi } from '../api/stats';
import {
  PLANT_STATUS_LABELS,
  PLANT_STATUS_EMOJI,
  type Stats,
  type PlantStatus,
} from '../types';

interface StatsDashboardProps {
  onClose: () => void;
}

const STATUS_ORDER: PlantStatus[] = [
  'sown',
  'growing',
  'flowering',
  'fruiting',
  'done',
];

const STATUS_COLORS: Record<PlantStatus, string> = {
  sown: '#a1887f',
  growing: '#4caf50',
  flowering: '#ec407a',
  fruiting: '#ff9800',
  done: '#607d8b',
};

export function StatsDashboard({ onClose }: StatsDashboardProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    statsApi
      .get()
      .then(setStats)
      .catch((err) => {
        console.error(err);
        alert('Не удалось загрузить статистику');
      })
      .finally(() => setLoading(false));
  }, []);

  // Esc закрывает
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  if (loading) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="stats-modal" onClick={(e) => e.stopPropagation()}>
          <div className="stats-close-bar">
            <button className="btn-icon" onClick={onClose} aria-label="Закрыть">
              ×
            </button>
          </div>
          <p className="muted" style={{ padding: 40, textAlign: 'center' }}>
            Считаю статистику...
          </p>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const { totals, bySpecies, bySpeciesLocation, byZone, topContainers } = stats;

  const totalSeeds = totals.total_seeds || 1;
  const germinated = totals.germinated ?? 0;
  const germinationRate = Math.round((germinated / totalSeeds) * 100);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="stats-modal" onClick={(e) => e.stopPropagation()}>
        {/* Только крестик, без заголовка */}
        <div className="stats-close-bar">
          <button className="btn-icon" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>

        <div className="stats-body">
          {/* ===== KPI ===== */}
          <div className="stats-kpi">
            <div className="kpi-card">
              <div className="kpi-label">Всего растений</div>
              <div className="kpi-value">{totals.plants}</div>
              <div className="kpi-sub">
                {totals.batches} партий · {totals.containers} контейнеров
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-label">Всхожесть</div>
              <div className="kpi-value" style={{ color: '#4caf50' }}>
                {germinationRate}%
              </div>
              <div className="kpi-sub">
                  {germinated} из {totals.total_seeds} семян взошли
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-label">Цветёт</div>
              <div className="kpi-value" style={{ color: '#ec407a' }}>
                {totals.byStatus.flowering}
              </div>
              <div className="kpi-sub">
                {totals.byStatus.fruiting} плодоносит
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-label">Средний возраст</div>
              <div className="kpi-value">
                {totals.avg_age_days != null
                  ? `${totals.avg_age_days} дн`
                  : '—'}
              </div>
              <div className="kpi-sub">
                посеяно {totals.total_seeds} семян
              </div>
            </div>
          </div>

          {/* ===== Распределение статусов ===== */}
          <div className="stats-section">
            <h4>Распределение по статусам</h4>

            {totals.plants === 0 ? (
              <p className="muted">Нет растений</p>
            ) : (
              <>
                <div className="status-distribution">
                  {STATUS_ORDER.map((status) => {
                    const count = totals.byStatus[status];
                    if (count === 0) return null;
                    const percent = (count / totals.plants) * 100;

                    return (
                      <div
                        key={status}
                        className="status-segment"
                        style={{
                          width: `${percent}%`,
                          background: STATUS_COLORS[status],
                        }}
                        title={`${PLANT_STATUS_LABELS[status]}: ${count}`}
                      >
                        {percent > 8 && `${Math.round(percent)}%`}
                      </div>
                    );
                  })}
                </div>

                <div className="status-legend">
                  {STATUS_ORDER.map((status) => {
                    const count = totals.byStatus[status];
                    if (count === 0) return null;

                    return (
                      <div key={status} className="status-legend-item">
                        <span
                          className="status-legend-dot"
                          style={{ background: STATUS_COLORS[status] }}
                        />
                        <span className="status-legend-text">
                          <span>{PLANT_STATUS_EMOJI[status]}</span>{' '}
                          <span>{PLANT_STATUS_LABELS[status]}</span>
                        </span>
                        <strong>{count}</strong>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <div className="stats-grid">
            {/* ===== Всхожесть по сортам (от лучшей к худшей) ===== */}
            <div className="stats-section">
              <h4>Всхожесть по сортам</h4>

              {bySpecies.length === 0 ? (
                <p className="muted">Нет данных</p>
              ) : (
                <div className="species-table">
                  <div className="species-row species-header">
                    <span>Сорт</span>
                    <span className="species-bar-col"></span>
                    <span className="species-rate">%</span>
                  </div>

                  {bySpecies.slice(0, 10).map((s, i) => (
                    <div
                      key={`${s.species}-${s.variety}-${i}`}
                      className="species-row"
                    >
                      <div className="species-name">
                        <strong>{s.species}</strong>
                        {s.variety && <span> · {s.variety}</span>}
                        <div className="species-meta">
                          {s.germinated} из {s.seeds} · {s.batches} парт.
                        </div>
                      </div>

                      <div className="species-bar-col">
                        <div className="species-bar">
                          <div
                            className="species-bar-fill"
                            style={{
                              width: `${Math.min(100, s.rate)}%`,
                              background:
                                s.rate >= 70
                                  ? '#4caf50'
                                  : s.rate >= 40
                                  ? '#ff9800'
                                  : '#e57373',
                            }}
                          />
                        </div>
                      </div>

                      <div className="species-rate">{s.rate}%</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ===== Растения по зонам ===== */}
			<div className="stats-section">
			<h4>Растения по зонам</h4>

			{byZone.length === 0 ? (
				<p className="muted">Нет зон</p>
			) : (
				<div className="zone-bars">
				{byZone.map((z) => {
					const percentOfTotal =
					totals.plants > 0
						? Math.round((z.plants / totals.plants) * 100)
						: 0;

					return (
					<div key={z.id} className="zone-bar-row">
						<div className="zone-bar-label">
						<span className="zone-bar-name">{z.name}</span>
						<span className="zone-bar-percent">{percentOfTotal}%</span>
						</div>
						<div className="zone-bar">
						<div
							className="zone-bar-fill"
							style={{
							width: `${percentOfTotal}%`,
							}}
						/>
						</div>
						<div className="zone-bar-caption">
						{z.plants} раст. · {z.containers} конт.
						</div>
					</div>
					);
				})}
				</div>
			)}
			</div>
          </div>

          {/* ===== Сорт по зонам и контейнерам ===== */}
          <div className="stats-section">
            <h4>Сорт по зонам и контейнерам</h4>

            {bySpeciesLocation.length === 0 ? (
              <p className="muted">Нет растений</p>
            ) : (
              <div className="species-location-list">
                {bySpeciesLocation.map((group, gi) => (
                  <div
                    key={`${group.species}-${group.variety}-${gi}`}
                    className="species-location-group"
                  >
                    <div className="species-location-header">
                      <span className="species-location-name">
                        {group.species}
                        {group.variety && (
                          <span className="species-location-variety">
                            {' '}
                            · {group.variety}
                          </span>
                        )}
                      </span>
                      <span className="species-location-total">
                        {group.total} шт
                      </span>
                    </div>

                    <div className="species-location-items">
                      {group.locations.map((loc, li) => {
                        const zoneLabel = loc.zone_name ?? '— без зоны';
                        const containerLabel =
                          loc.container_name ?? '— без контейнера';

                        return (
                          <div
                            key={`${loc.zone_id}-${loc.container_id}-${li}`}
                            className="species-location-item"
                          >
                            <div className="species-location-place">
                              <span className="species-location-zone">
                                {zoneLabel}
                              </span>
                              <span className="species-location-sep">/</span>
                              <span className="species-location-container">
                                {containerLabel}
                              </span>
                            </div>

                            <div className="species-location-statuses">
                              {STATUS_ORDER.map((status) => {
                                const count = loc.status_counts[status] ?? 0;
                                if (count === 0) return null;

                                return (
                                  <span
                                    key={status}
                                    className="status-chip"
                                    style={{
                                      // Светлый фон того же цвета + тёмный текст
                                      background: `${STATUS_COLORS[status]}22`,
                                      color: STATUS_COLORS[status],
                                      border: `1px solid ${STATUS_COLORS[status]}55`,
                                    }}
                                    title={PLANT_STATUS_LABELS[status]}
                                  >
                                    {PLANT_STATUS_EMOJI[status]} {count}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ===== Топ контейнеров ===== */}
          <div className="stats-section">
            <h4>Самые загруженные контейнеры</h4>

            {topContainers.length === 0 ? (
              <p className="muted">Нет данных</p>
            ) : (
              <div className="top-list">
                {topContainers.map((c, i) => (
                  <div key={c.id} className="top-list-item">
                    <span className="top-list-rank">{i + 1}</span>
                    <div className="top-list-name">
                      <strong>{c.name}</strong>
                      {c.zone_name && (
                        <span className="top-list-meta"> · {c.zone_name}</span>
                      )}
                    </div>
                    <span className="top-list-value">{c.plants}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}