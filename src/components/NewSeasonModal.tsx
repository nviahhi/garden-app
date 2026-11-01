import { useState } from 'react';
import { exportApi } from '../api/export';
import { exportPlantsToPdf } from '../utils/pdfExport';
import { useSeasonStore } from '../store/useSeasonStore';
import { useZoneStore } from '../store/useZoneStore';
import { useContainerStore } from '../store/useContainerStore';
import { useBatchStore } from '../store/useBatchStore';
import type { Zone, Container } from '../types';

interface NewSeasonModalProps {
  zones: Zone[];
  containers: Container[];
  onClose: () => void;
  onSeasonStarted: () => void;
}

type Step = 'recommend' | 'confirm' | 'done';

export function NewSeasonModal({
  zones,
  containers,
  onClose,
  onSeasonStarted,
}: NewSeasonModalProps) {
  const [step, setStep] = useState<Step>('recommend');
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadZones = useZoneStore((s) => s.loadZones);
  const loadContainers = useContainerStore((s) => s.loadContainers);
  const loadBatches = useBatchStore((s) => s.loadBatches);
  const loadPlants = useBatchStore((s) => s.loadPlants);

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    try {
      const allPlants = await exportApi.plantsAll();
      await exportPlantsToPdf({
        title: 'Журнал рассады — архив сезона',
        subtitle: 'Экспорт перед началом нового сезона',
        plants: allPlants,
        zones,
        containers,
        filename: `garden-season-archive-${new Date().toISOString().slice(0, 10)}.pdf`,
      });
      setExported(true);
    } catch (err) {
      console.error(err);
      setError('Не удалось сформировать PDF. Попробуйте ещё раз.');
    } finally {
      setExporting(false);
    }
  };

  const handleStart = async () => {
    const ok = await useSeasonStore.getState().start();
    if (!ok) return;
    await Promise.all([
      loadZones(),
      loadContainers(),
      loadBatches(),
      loadPlants(),
    ]);
    setStep('done');
  };

  const handleRestore = async () => {
    const ok = await useSeasonStore.getState().reset();
    if (!ok) return;
    await Promise.all([
      loadZones(),
      loadContainers(),
      loadBatches(),
      loadPlants(),
    ]);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal season-modal" onClick={(e) => e.stopPropagation()}>
        {step === 'recommend' && (
          <>
            <div className="panel-header">
              <h3>Новый сезон</h3>
              <button className="btn-icon" onClick={onClose} aria-label="Закрыть">×</button>
            </div>

            <div className="season-body">
              <p className="season-lead">
                Перед новым сезоном рекомендуем сохранить архив текущего —
                выгрузите журнал в PDF. Все данные останутся в базе, но вы
                начнёте сезон с чистого листа.
              </p>

              <div className="season-stats">
                <div className="season-stat">
                  <span className="season-stat-num">{zones.length}</span>
                  <span className="season-stat-label">зон</span>
                </div>
                <div className="season-stat">
                  <span className="season-stat-num">{containers.length}</span>
                  <span className="season-stat-label">контейнеров</span>
                </div>
              </div>

              {error && <div className="form-error">{error}</div>}

              <div className="season-actions">
                <button
                  className="btn btn-primary btn-block"
                  onClick={handleExport}
                  disabled={exporting}
                >
                  {exporting
                    ? '⏳ Формирую PDF...'
                    : exported
                    ? '✅ PDF сохранён'
                    : '📄 Экспортировать сезон в PDF'}
                </button>

                <button
                  className="btn btn-ghost btn-block"
                  onClick={() => setStep('confirm')}
                >
                  Пропустить экспорт →
                </button>
              </div>

              {exported && (
                <button
                  className="btn btn-primary btn-block season-next"
                  onClick={() => setStep('confirm')}
                >
                  Продолжить →
                </button>
              )}
            </div>
          </>
        )}

        {step === 'confirm' && (
          <>
            <div className="panel-header">
              <h3>Подтвердите</h3>
              <button className="btn-icon" onClick={onClose} aria-label="Закрыть">×</button>
            </div>

            <div className="season-body">
              <p className="season-lead">
                Текущий сезон будет скрыт из интерфейса. Данные останутся в базе —
                вы всегда сможете вернуться к ним через экспорт.
              </p>

              <div className="season-actions">
                <button
                  className="btn btn-ghost"
                  onClick={() => setStep('recommend')}
                >
                  ← Назад
                </button>
                <button
                  className="btn btn-danger"
                  onClick={handleStart}
                >
                  Начать новый сезон
                </button>
              </div>
            </div>
          </>
        )}

        {step === 'done' && (
          <>
            <div className="panel-header">
              <h3>Новый сезон</h3>
            </div>

            <div className="season-body season-done">
              <div className="season-done-icon">🌱</div>
              <p className="season-lead">
                Чистый лист готов. Создайте первую зону и контейнеры —
                предыдущий сезон останется в архиве.
              </p>
              <button
                className="btn btn-primary btn-block"
                onClick={onSeasonStarted}
              >
                Создать первую зону
              </button>
              <button
                className="season-back-link"
                onClick={handleRestore}
              >
                Показать прошлый сезон
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
