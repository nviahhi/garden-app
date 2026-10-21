import { useEffect, useMemo, useRef, useState } from 'react';
import { useBatchStore } from '../store/useBatchStore';
import { useContainerStore } from '../store/useContainerStore';
import { useZoneStore } from '../store/useZoneStore';
import {
  PLANT_STATUS_LABELS,
  PLANT_STATUS_EMOJI,
  type Plant,
} from '../types';

interface PlantSearchProps {
  onClose: () => void;
  onSelect: (plant: Plant, zoneId: number | null) => void;
}

export function PlantSearch({ onClose, onSelect }: PlantSearchProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const plants = useBatchStore((s) => s.plants);
  const containers = useContainerStore((s) => s.containers);
  const zones = useZoneStore((s) => s.zones);

  // Фокус в поле при открытии
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Esc закрывает
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // ===== Поиск =====
  const results = useMemo(() => {
  const q = query.trim().toLowerCase();

  if (!q) {
    return [...plants]
      .sort(
        (a, b) =>
          (b.display_number ?? b.number) - (a.display_number ?? a.number)
      )
      .slice(0, 20);
  }

  // Убираем решётку и пробелы из числового запроса: "#78" → "78"
  const numericQuery = q.replace(/^#\s*/, '');

  const found = plants.filter((p) => {
    const num = String(p.display_number ?? p.number);
    const species = (p.species ?? '').toLowerCase();
    const variety = (p.variety ?? '').toLowerCase();

    // Склейки
    const fullName = `${species} ${variety}`.trim();
    const reverseName = `${variety} ${species}`.trim();

    const dateISO = p.sowing_date ?? '';
    const dateStr = p.sowing_date
      ? new Date(p.sowing_date).toLocaleDateString('ru-RU')
      : '';

    const container = containers.find((c) => c.id === p.container_id);
    const containerName = (container?.name ?? '').toLowerCase();
    const zone = zones.find((z) => z.id === container?.zone_id);
    const zoneName = (zone?.name ?? '').toLowerCase();

    return (
      // Поиск по номеру: и "78", и "#78" работают
      num.includes(numericQuery) ||
      num === numericQuery ||
      species.includes(q) ||
      variety.includes(q) ||
      fullName.includes(q) ||
      reverseName.includes(q) ||
      dateISO.includes(q) ||
      dateStr.includes(q) ||
      containerName.includes(q) ||
      zoneName.includes(q)
    );
  });

  found.sort(
    (a, b) => (a.display_number ?? a.number) - (b.display_number ?? b.number)
  );

  return found.slice(0, 50);
}, [plants, query, containers, zones]);

  const getContainer = (id: number | null) =>
    containers.find((c) => c.id === id);
  const getZone = (zoneId: number | null | undefined) =>
    zones.find((z) => z.id === zoneId);

  const handleSelect = (plant: Plant) => {
    const container = getContainer(plant.container_id);
    onSelect(plant, container?.zone_id ?? null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && results.length > 0) {
      handleSelect(results[0]);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="search-modal" onClick={(e) => e.stopPropagation()}>
        <div className="search-header">
          <span className="search-icon">🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Номер, культура, сорт, дата, контейнер..."
            className="search-input"
          />
          <button className="btn-icon" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>

        <div className="search-results">
          {results.length === 0 && (
            <p className="search-empty">Ничего не найдено</p>
          )}

          {results.map((plant) => {
            const container = getContainer(plant.container_id);
            const zone = getZone(container?.zone_id);
            const num = plant.display_number ?? plant.number;

            return (
              <button
                key={plant.id}
                className="search-result"
                onClick={() => handleSelect(plant)}
              >
                <div className="search-result-main">
                  <span className="search-result-num">#{num}</span>
                  <span className="search-result-name">
                    {plant.species}
                    {plant.variety && ` · ${plant.variety}`}
                  </span>
                  <span className="search-result-status">
                    {PLANT_STATUS_EMOJI[plant.status]}{' '}
                    {PLANT_STATUS_LABELS[plant.status]}
                  </span>
                </div>

                <div className="search-result-meta">
                  {plant.sowing_date && (
                    <span>
                      Посеяно{' '}
                      {new Date(plant.sowing_date).toLocaleDateString('ru-RU')}
                    </span>
                  )}
                  {zone && <span> · {zone.name}</span>}
                  {container && <span> · {container.name}</span>}
                  {plant.cell_index != null && (
                    <span> · ячейка {plant.cell_index + 1}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="search-footer">
          <kbd>Esc</kbd> закрыть · <kbd>Enter</kbd> открыть первый ·{' '}
          <span className="search-count">
            {results.length}{' '}
            {results.length === 1
              ? 'результат'
              : results.length >= 2 && results.length <= 4
              ? 'результата'
              : 'результатов'}
          </span>
        </div>
      </div>
    </div>
  );
}