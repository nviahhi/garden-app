/**
 * Справочник норм по культурам.
 *
 * Эти данные — «факты», которые модель не должна «вспоминать» (она лжёт).
 * Они подмешиваются в промпт, и модель оперирует ими как входными данными.
 * Фиксируйте: вид → данные.
 */

/**
 * @typedef {Object} PlantNorm
 * @property {string}  name         — читаемое название
 * @property {string}  [sowingWindow] — окно посева (например 'март-апрель')
 * @property {number}  daysToGerminationMin — дней до всходов (минимум)
 * @property {number}  daysToGerminationMax — дней до всходов (максимум)
 * @property {string}  minPotLiters — минимальный горшок (л)
 * @property {string}  transplantable — 'хорошо' | 'плохо' | 'нельзя'
 * @property {string}  transplantWeek — когда лучше пересаживать (например 'после 3-4 листьев')
 * @property {string}  notes          — дополнительные нюансы
 */

/** @type {Record<string, PlantNorm>} */
const REFERENCE = {
  'томат': {
    name: 'Томат',
    sowingWindow: 'февраль-апрель',
    daysToGerminationMin: 7,
    daysToGerminationMax: 14,
    minPotLiters: '3-5',
    transplantable: 'хорошо',
    transplantWeek: 'после появления 3-4 настоящих листьев',
    notes: 'Очень хорошо переносит перевалку. Корневая система активно растёт.',
  },
  'перец': {
    name: 'Перец',
    sowingWindow: 'февраль-март',
    daysToGerminationMin: 10,
    daysToGerminationMax: 14,
    minPotLiters: '3-5',
    transplantable: 'плохо',
    transplantWeek: 'как можно раньше, перевалкой',
    notes: 'Боится повреждения корней. Пересаживайте ТОЛЬКО перевалкой с комом земли.',
  },
  'огурец': {
    name: 'Огурец',
    sowingWindow: 'март-май',
    daysToGerminationMin: 5,
    daysToGerminationMax: 7,
    minPotLiters: '3-5',
    transplantable: 'плохо',
    transplantWeek: 'пересаживать перевалкой на постоянное место',
    notes: 'Стержневой корень, пересадка с открытым корнем невозможна. Только перевалка.',
  },
  'базилик': {
    name: 'Базилик',
    sowingWindow: 'март-май',
    daysToGerminationMin: 7,
    daysToGerminationMax: 10,
    minPotLiters: '1-2',
    transplantable: 'хорошо',
    transplantWeek: 'после появления 2-3 пар листьев',
    notes: 'Быстрорастущий. Можно щипать верхушки для кустистости.',
  },
  'петуния': {
    name: 'Петуния',
    sowingWindow: 'февраль-март',
    daysToGerminationMin: 7,
    daysToGerminationMax: 14,
    minPotLiters: '0.5-1',
    transplantable: 'хорошо',
    transplantWeek: 'после пикировки — в кассету, затем на постоянное место',
    notes: 'Цветение в рассадной таре — сигнал что корни освоили объём. Нужна подкормка.',
  },
  'морковь': {
    name: 'Морковь',
    sowingWindow: 'апрель-май',
    daysToGerminationMin: 14,
    daysToGerminationMax: 21,
    minPotLiters: '—',
    transplantable: 'нельзя',
    transplantWeek: '—',
    notes: 'Стержневой корень — пересадка НЕВОЗМОЖНА. Сейте сразу в грядку или глубокий контейнер.',
  },
  'салат': {
    name: 'Салат',
    sowingWindow: 'апрель-сентябрь',
    daysToGerminationMin: 3,
    daysToGerminationMax: 7,
    minPotLiters: '0.5-1',
    transplantable: 'хорошо',
    transplantWeek: 'после появления 2-3 листьев',
    notes: 'Холодостойкий. Растёт весь сезон.',
  },
  'лук': {
    name: 'Лук (репка)',
    sowingWindow: 'февраль-март',
    daysToGerminationMin: 7,
    daysToGerminationMax: 14,
    minPotLiters: '1-2',
    transplantable: 'хорошо',
    transplantWeek: 'когда перо достигнет 10-12 см',
    notes: 'Можно выращивать на перо в комнатных условиях.',
  },
};

/**
 * Получить справочную информацию по виду растения.
 *
 * @param {string} species — вид из БД (например 'Томат')
 * @returns {PlantNorm | null}
 */
function getReference(species) {
  return REFERENCE[species?.toLowerCase()] ?? null;
}

module.exports = { REFERENCE, getReference };
