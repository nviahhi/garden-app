import { useZoneStore } from '../store/useZoneStore';
import { useContainerStore } from '../store/useContainerStore';
import { useBatchStore } from '../store/useBatchStore';
import { useSeasonStore } from '../store/useSeasonStore';

/**
 * Сбрасывает все сторы данных к пустому состоянию.
 * Используется при выходе из аккаунта, чтобы не полагаться на
 * полную перезагрузку страницы.
 */
export function resetAllData(): void {
  useZoneStore.getState().reset();
  useContainerStore.getState().reset();
  useBatchStore.getState().reset();
  useSeasonStore.getState().resetAll();
}
