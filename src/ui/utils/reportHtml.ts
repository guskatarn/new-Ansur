import type { DutInfo, ElementResultStatus, Limit, TestTemplate } from '../../domain/types.js';
import type { DraftResult } from '../runnerTypes.js';

export interface ReportData {
  template: TestTemplate;
  dut: DutInfo;
  executedBy: string;
  executedAt: string;
  draftResults: DraftResult[];
  overallStatus: ElementResultStatus;
  recordId: string;
}

export function generateReportHtml(data: ReportData): string {
  const { template, dut, executedBy, executedAt, draftResults, overallStatus, recordId } = data;

  const passCount = draftResults.filter((r) => r.status === 'pass').length;
  const failCount = draftResults.filter((r) => r.status === 'fail').length;
  const skipCount = draftResults.filter((r) => (r.status ?? 'skipped') === 'skipped').length;

  const statusCls = overallStatus === 'pass' ? 'pass' : overallStatus === 'fail' ? 'fail' : 'other';
  const statusLabel =
    overallStatus === 'pass'
      ? '✓ PASS — CONFORME'
      : overallStatus === 'fail'
        ? '✗ FAIL — NON CONFORME'
        : '— RÉSULTAT INDÉTERMINÉ';

  const locationRow =
    dut.location !== undefined
      ? `<tr><td class="lbl">Lieu / service</td><td colspan="3">${esc(dut.location)}</td></tr>`
      : '';

  const rows = template.elements
    .map((el, i) => {
      const draft = draftResults[i] ?? { status: null, measuredValue: '', note: '' };
      const status: ElementResultStatus = draft.status ?? 'skipped';
      const failRowAttr = status === 'fail' ? ' class="fail-row"' : '';
      const limitStr = esc(formatLimit(el.limit));
      const valueStr =
        draft.measuredValue !== '' ? `<span class="mono">${esc(draft.measuredValue)}</span>` : '—';
      const noteStr = draft.note.trim() !== '' ? esc(draft.note) : '—';

      return `<tr${failRowAttr}>
        <td class="num">${i + 1}</td>
        <td class="id">${esc(el.id)}</td>
        <td>${esc(el.label)}</td>
        <td class="mono">${limitStr}</td>
        <td style="text-align:right">${valueStr}</td>
        <td>${statusBadge(status)}</td>
        <td>${noteStr}</td>
      </tr>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Rapport de test — ${esc(template.name)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; color: #212529; line-height: 1.4; }
    @page { size: A4; margin: 2cm 1.5cm; }

    .header { display: flex; justify-content: space-between; align-items: flex-end;
               border-bottom: 3px solid #0056b3; padding-bottom: 10px; margin-bottom: 16px; }
    .header-left h1 { font-size: 16pt; color: #0056b3; margin-bottom: 3px; }
    .header-left .sub { font-size: 9pt; color: #6c757d; }
    .header-right { font-size: 9pt; color: #6c757d; text-align: right; line-height: 1.7; }

    .status-box { text-align: center; padding: 10px 20px; border-radius: 6px;
                  font-size: 20pt; font-weight: 800; margin: 14px 0; letter-spacing: 0.05em; }
    .pass  { background: #198754; color: #fff; }
    .fail  { background: #dc3545; color: #fff; }
    .other { background: #6c757d; color: #fff; }

    .counters { display: flex; gap: 10px; margin: 8px 0 14px; flex-wrap: wrap; }
    .counter { padding: 3px 12px; border-radius: 12px; font-size: 10pt; font-weight: 600; }
    .c-pass { background: #d1e7dd; color: #0a3622; }
    .c-fail { background: #f8d7da; color: #842029; }
    .c-skip { background: #fff3cd; color: #664d03; }

    .info-table { width: 100%; border-collapse: collapse; background: #f8f9fa;
                  border: 1px solid #dee2e6; margin-bottom: 16px; }
    .info-table td { padding: 5px 10px; font-size: 10pt; }
    .info-table .lbl { color: #6c757d; font-size: 9pt; text-transform: uppercase;
                        letter-spacing: 0.04em; width: 130px; white-space: nowrap; }

    h2 { font-size: 12pt; color: #0056b3; margin: 14px 0 6px;
          border-bottom: 1px solid #dee2e6; padding-bottom: 4px; }

    table.results { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
    table.results thead tr { background: #0056b3; color: #fff; }
    table.results th { padding: 6px 7px; text-align: left; font-weight: 600;
                        font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.04em; }
    table.results td { padding: 5px 7px; border-bottom: 1px solid #e9ecef; vertical-align: top; }
    table.results tr:nth-child(even) td { background: #f8f9fa; }
    table.results tr.fail-row td { background: #fff5f5 !important; }

    .num  { color: #adb5bd; font-size: 8.5pt; text-align: center; width: 24px; }
    .id   { font-family: "Courier New", monospace; font-size: 8.5pt; color: #6c757d; white-space: nowrap; }
    .mono { font-family: "Courier New", monospace; font-size: 9pt; }

    .badge { display: inline-block; padding: 1px 7px; border-radius: 10px;
              font-size: 8.5pt; font-weight: 600; white-space: nowrap; }
    .b-pass { background: #d1e7dd; color: #0a3622; }
    .b-fail { background: #f8d7da; color: #842029; }
    .b-skip { background: #fff3cd; color: #664d03; }
    .b-na   { background: #e2e3e5; color: #383d41; }

    .footer { margin-top: 20px; padding-top: 8px; border-top: 1px solid #dee2e6;
               font-size: 8.5pt; color: #6c757d;
               display: flex; justify-content: space-between; }
  </style>
</head>
<body>

  <div class="header">
    <div class="header-left">
      <h1>Rapport de test</h1>
      <span class="sub">${esc(template.name)} &nbsp;·&nbsp; version ${template.version}</span>
    </div>
    <div class="header-right">
      ${esc(formatDate(executedAt))}<br>
      Technicien&nbsp;: <strong>${esc(executedBy)}</strong>
    </div>
  </div>

  <div class="status-box ${statusCls}">${statusLabel}</div>

  <div class="counters">
    <span class="counter c-pass">${passCount} conforme(s)</span>
    <span class="counter c-fail">${failCount} non conforme(s)</span>
    <span class="counter c-skip">${skipCount} ignoré(s)</span>
  </div>

  <table class="info-table">
    <tr>
      <td class="lbl">Équipement</td>
      <td>${esc(dut.model)}</td>
      <td class="lbl">N° de série</td>
      <td><strong>${esc(dut.serialNumber)}</strong></td>
    </tr>
    ${locationRow}
  </table>

  <h2>Résultats détaillés</h2>

  <table class="results">
    <thead>
      <tr>
        <th>#</th>
        <th>ID commande</th>
        <th>Libellé</th>
        <th>Limite</th>
        <th>Valeur lue</th>
        <th>Statut</th>
        <th>Note</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <div class="footer">
    <span>Généré par ANSUR Replacement</span>
    <span>Record ID&nbsp;: ${esc(recordId)}</span>
  </div>

</body>
</html>`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function formatLimit(limit: Limit | undefined): string {
  if (limit === undefined) return '—';
  if (limit.kind === 'boolean') return `Attendu : ${limit.expected ? 'Vrai' : 'Faux'}`;
  const parts: string[] = [];
  if (limit.min !== undefined) parts.push(`≥ ${limit.min}`);
  if (limit.max !== undefined) parts.push(`≤ ${limit.max}`);
  const range = parts.join(' / ');
  return range !== '' ? `${range} ${limit.unit}` : limit.unit;
}

function statusBadge(status: ElementResultStatus): string {
  const map: Record<ElementResultStatus, { cls: string; label: string }> = {
    pass: { cls: 'b-pass', label: '✓ Conforme' },
    fail: { cls: 'b-fail', label: '✗ Non conforme' },
    skipped: { cls: 'b-skip', label: 'Ignoré' },
    'not-applicable': { cls: 'b-na', label: 'N/A' },
  };
  const { cls, label } = map[status];
  return `<span class="badge ${cls}">${label}</span>`;
}
