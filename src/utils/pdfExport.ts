import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  PLANT_STATUS_LABELS,
  PLANT_STATUS_EMOJI,
  type Plant,
  type PlantStatus,
  type PlantEvent,
  type Zone,
  type Container,
} from '../types';

export interface ExportOptions {
  title: string;
  subtitle?: string;
  plants: Plant[];
  zones: Zone[];
  containers: Container[];
  filename: string;
  /** Поля по краям A4 (мм). По умолчанию 15 */
  marginMm?: number;
}

// ===== Константы A4 =====
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const DEFAULT_MARGIN_MM = 15;

// Отступы внутри ячеек таблицы
const CELL_PADDING = '12px 10px';
const CELL_BORDER = '1px solid #e8e8d8';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(iso: string | undefined | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatHistory(events: PlantEvent[] | undefined): string {
  if (!events || events.length === 0) {
    return '<span style="color:#a5b8a5;">—</span>';
  }

  const lines = events.map((e) => {
    const date = formatDate(e.event_date);

    if (e.event_type === 'transplant') {
      const from = e.from_container_name ?? '—';
      const to = e.to_container_name ?? '—';
      return `${date}: ${from} → ${to}`;
    }
    if (e.event_type === 'status_change' && e.from_status && e.to_status) {
      const from =
        PLANT_STATUS_LABELS[e.from_status as PlantStatus] ?? e.from_status;
      const to = PLANT_STATUS_LABELS[e.to_status as PlantStatus] ?? e.to_status;
      return `${date}: ${from} → ${to}`;
    }
    if (e.notes) {
      return `${date}: ${e.notes}`;
    }
    return `${date}: ${e.event_type}`;
  });

  return lines.map((l) => escapeHtml(l)).join('<br>');
}

function buildHtml(opts: ExportOptions): string {
  const { title, subtitle, plants, zones, containers } = opts;

  const sorted = [...plants].sort(
    (a, b) => (a.display_number ?? a.number) - (b.display_number ?? b.number)
  );

  const rows = sorted
    .map((p) => {
      const container = containers.find((c) => c.id === p.container_id);
      const zone = zones.find((z) => z.id === container?.zone_id);
      const num = p.display_number ?? p.number;

      const containerLabel = container
        ? `${container.name}${zone ? ` · ${zone.name}` : ''}${
            p.cell_index != null ? ` · ячейка ${p.cell_index + 1}` : ''
          }`
        : '—';

      return `
        <tr>
          <td style="padding:${CELL_PADDING};text-align:center;vertical-align:top;font-weight:bold;color:#2e7d32;border:${CELL_BORDER};">${num}</td>
          <td style="padding:${CELL_PADDING};text-align:left;vertical-align:top;border:${CELL_BORDER};">
            <strong>${escapeHtml(p.species ?? '')}</strong>
            ${p.variety ? ` · ${escapeHtml(p.variety)}` : ''}
          </td>
          <td style="padding:${CELL_PADDING};text-align:center;vertical-align:top;white-space:nowrap;border:${CELL_BORDER};">
            ${PLANT_STATUS_EMOJI[p.status]} ${PLANT_STATUS_LABELS[p.status]}
          </td>
          <td style="padding:${CELL_PADDING};text-align:center;vertical-align:top;white-space:nowrap;border:${CELL_BORDER};">
            ${formatDate(p.sowing_date)}
          </td>
          <td style="padding:${CELL_PADDING};font-size:11px;vertical-align:top;border:${CELL_BORDER};">
            ${escapeHtml(containerLabel)}
          </td>
          <td style="padding:${CELL_PADDING};font-size:11px;line-height:1.6;vertical-align:top;border:${CELL_BORDER};color:#4a7c4a;">
            ${formatHistory(p.events)}
          </td>
        </tr>
      `;
    })
    .join('');

  const now = new Date().toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return `
    <div style="font-family:'Helvetica Neue',Arial,sans-serif;color:#2e4a2e;">
      <div style="border-bottom:2px solid #4a7c4a;padding-bottom:12px;margin-bottom:16px;">
        <h1 style="font-size:22px;margin:0 0 4px 0;color:#2e4a2e;">🌱 ${escapeHtml(title)}</h1>
        ${subtitle ? `<p style="margin:0;color:#6b8e6b;font-size:13px;">${escapeHtml(subtitle)}</p>` : ''}
        <p style="margin:8px 0 0 0;color:#8b7355;font-size:11px;">
          Экспорт от ${now} · Растений: ${plants.length}
        </p>
      </div>

      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead>
          <tr style="background:#e8f5e9;">
            <th style="padding:10px;text-align:center;vertical-align:top;border:${CELL_BORDER};width:44px;">№</th>
            <th style="padding:10px;text-align:left;vertical-align:top;border:${CELL_BORDER};">Культура / сорт</th>
            <th style="padding:10px;text-align:center;vertical-align:top;border:${CELL_BORDER};width:110px;">Статус</th>
            <th style="padding:10px;text-align:center;vertical-align:top;border:${CELL_BORDER};width:84px;">Посев</th>
            <th style="padding:10px;text-align:left;vertical-align:top;border:${CELL_BORDER};width:150px;">Контейнер</th>
            <th style="padding:10px;text-align:left;vertical-align:top;border:${CELL_BORDER};">История</th>
          </tr>
        </thead>
        <tbody>
          ${
            rows ||
            '<tr><td colspan="6" style="text-align:center;padding:24px;color:#8b7355;">Нет растений</td></tr>'
          }
        </tbody>
      </table>

      <p style="margin-top:28px;font-size:10px;color:#a5b8a5;text-align:center;">
        Сформировано в Журнале рассады
      </p>
    </div>
  `;
}

export async function exportPlantsToPdf(opts: ExportOptions): Promise<void> {
  const marginMm = opts.marginMm ?? DEFAULT_MARGIN_MM;

  const html = buildHtml(opts);

  // Скрытый контейнер для рендера
  const wrapper = document.createElement('div');
  wrapper.style.cssText = `
    position: fixed;
    left: -10000px;
    top: 0;
    width: 900px;
    background: #ffffff;
    padding: 0;
    box-sizing: border-box;
    z-index: -1;
  `;
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper);

  try {
    const canvas = await html2canvas(wrapper, {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
      useCORS: true,
    });

    // ===== Размеры в мм =====
    const contentWidthMm = A4_WIDTH_MM - marginMm * 2;
    const contentHeightMm = A4_HEIGHT_MM - marginMm * 2;

    // Сколько canvas-пикселей соответствует 1 мм
    const pxPerMm = canvas.width / contentWidthMm;

    // Высота контента, помещающегося на одну страницу (в canvas-пикселях)
    const pageHeightPx = Math.floor(contentHeightMm * pxPerMm);

    // Сколько страниц нужно
    const totalPages = Math.max(1, Math.ceil(canvas.height / pageHeightPx));

    const pdf = new jsPDF('p', 'mm', 'a4');

    // ===== Нарезаем канвас постранично =====
    for (let i = 0; i < totalPages; i++) {
      if (i > 0) pdf.addPage();

      const srcY = i * pageHeightPx;
      const srcHeight = Math.min(pageHeightPx, canvas.height - srcY);

      // Создаём временный канвас с частью изображения для текущей страницы
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = srcHeight;

      const ctx = pageCanvas.getContext('2d');
      if (!ctx) continue;

      // Белый фон (если вдруг будут прозрачные области)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

      // Копируем нужный кусок
      ctx.drawImage(
        canvas,
        0, srcY, canvas.width, srcHeight,
        0, 0, canvas.width, srcHeight
      );

      const imgData = pageCanvas.toDataURL('image/png');
      const imgHeightMm = srcHeight / pxPerMm;

      pdf.addImage(
        imgData,
        'PNG',
        marginMm,
        marginMm,
        contentWidthMm,
        imgHeightMm
      );

      // Номер страницы (ASCII — кириллица в дефолтном шрифте jsPDF не работает)
      if (totalPages > 1) {
        pdf.setFontSize(9);
        pdf.setTextColor(165, 184, 165);
        pdf.text(
          `${i + 1} / ${totalPages}`,
          A4_WIDTH_MM - marginMm,
          A4_HEIGHT_MM - marginMm / 2,
          { align: 'right' }
        );
      }
    }

    pdf.save(opts.filename);
  } finally {
    document.body.removeChild(wrapper);
  }
}