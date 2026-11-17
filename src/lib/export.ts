// CSV and PDF exports. Everything is generated on-device.
import type { Exercise, PersonalRecord, Profile, Session } from '../db/types';
import { isCompleted } from './analytics';
import { fmtDate, fmtDuration, fmtVolume } from './format';
import { GOAL_LABEL, LEVEL_LABEL, MUSCLE_LABEL, RECORD_LABEL } from '../data/labels';
import type { Overview } from './stats';

function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Semicolon separated + BOM so Excel (pt-BR) opens it correctly. */
export function toCsv(rows: unknown[][]): string {
  return '﻿' + rows.map((r) => r.map(csvCell).join(';')).join('\r\n');
}

const iso = (t: number) => new Date(t).toISOString().slice(0, 19).replace('T', ' ');
const num = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');

export function exportSessionsCsv(sessions: Session[], suffix: string) {
  const rows: unknown[][] = [['data', 'treino', 'duracao_min', 'exercicios', 'series', 'repeticoes', 'volume_kg', 'recordes']];
  for (const s of sessions) {
    rows.push([iso(s.startedAt), s.name, num(s.durationSec / 60), s.exercises.filter((e) => e.sets.some(isCompleted)).length, s.setsDone, s.reps, num(s.volume), s.prs.length]);
  }
  download(`setly-treinos-${suffix}.csv`, new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }));
}

export function exportSetsCsv(sessions: Session[], exMap: Map<string, Exercise>, suffix: string) {
  const rows: unknown[][] = [['data', 'treino', 'exercicio', 'exercicio_en', 'grupo', 'serie', 'carga_kg', 'repeticoes', 'volume_kg', 'observacao']];
  for (const s of sessions) {
    for (const e of s.exercises) {
      const info = exMap.get(e.exerciseId);
      e.sets.forEach((set, i) => {
        if (!isCompleted(set)) return;
        rows.push([iso(s.startedAt), s.name, info?.namePt ?? e.exerciseId, info?.nameEn ?? '', info ? MUSCLE_LABEL[info.primary] : '', i + 1, num(set.weight ?? 0), set.reps, num((set.weight ?? 0) * (set.reps ?? 0)), set.notes]);
      });
    }
  }
  download(`setly-series-${suffix}.csv`, new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }));
}

export interface ReportInput {
  profile: Profile;
  periodLabel: string;
  from: number;
  to: number;
  overview: Overview;
  previous: Overview;
  streak: number;
  sessions: Session[];
  muscles: { group: string; sets: number }[];
  topExercises: { name: string; sessions: number; volume: number; bestWeight: number; change: number | null }[];
  records: PersonalRecord[];
  exMap: Map<string, Exercise>;
}

export async function exportReportPdf(r: ReportInput) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const M = 40;
  const purple: [number, number, number] = [139, 92, 246];
  const dark: [number, number, number] = [20, 20, 25];

  // header band
  doc.setFillColor(9, 9, 11);
  doc.rect(0, 0, W, 96, 'F');
  doc.setFillColor(...purple);
  doc.rect(0, 96, W, 3, 'F');
  doc.setFont('courier', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.text('SETLY GYM', M, 44);
  doc.setFont('courier', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(161, 161, 170);
  doc.text('Relatório de desempenho', M, 62);
  doc.text(`${r.periodLabel}  ·  ${fmtDate(r.from)} a ${fmtDate(r.to)}`, M, 78);
  doc.text(`Gerado em ${fmtDate(Date.now())}`, W - M, 78, { align: 'right' });

  let y = 128;
  doc.setTextColor(...dark);
  doc.setFont('courier', 'bold');
  doc.setFontSize(12);
  doc.text(r.profile.name || 'Atleta', M, y);
  doc.setFont('courier', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 100);
  doc.text(`Objetivo: ${GOAL_LABEL[r.profile.goal]}   Nível: ${LEVEL_LABEL[r.profile.level]}`, M, y + 14);

  const pct = (c: number, p: number) => (p ? `${c >= p ? '+' : ''}${Math.round(((c - p) / p) * 100)}%` : '—');
  autoTable(doc, {
    startY: y + 28,
    head: [['Indicador', 'Período', 'Período anterior', 'Variação']],
    body: [
      ['Treinos', r.overview.sessions, r.previous.sessions, pct(r.overview.sessions, r.previous.sessions)],
      ['Frequência semanal', r.overview.perWeek.toFixed(1), r.previous.perWeek.toFixed(1), pct(r.overview.perWeek, r.previous.perWeek)],
      ['Tempo total', fmtDuration(r.overview.durationSec), fmtDuration(r.previous.durationSec), pct(r.overview.durationSec, r.previous.durationSec)],
      ['Duração média', fmtDuration(r.overview.avgDurationSec), fmtDuration(r.previous.avgDurationSec), pct(r.overview.avgDurationSec, r.previous.avgDurationSec)],
      ['Volume total', fmtVolume(r.overview.volume), fmtVolume(r.previous.volume), pct(r.overview.volume, r.previous.volume)],
      ['Séries', r.overview.sets, r.previous.sets, pct(r.overview.sets, r.previous.sets)],
      ['Repetições', r.overview.reps, r.previous.reps, pct(r.overview.reps, r.previous.reps)],
      ['Sequência atual', `${r.streak} dias`, '', ''],
    ],
    theme: 'grid',
    styles: { font: 'courier', fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: purple, textColor: 255 },
    margin: { left: M, right: M },
  });

  const section = (title: string) => {
    // @ts-expect-error lastAutoTable is added by the plugin
    let yy = (doc.lastAutoTable?.finalY ?? y) + 28;
    if (yy > doc.internal.pageSize.getHeight() - 80) { doc.addPage(); yy = 50; }
    doc.setFont('courier', 'bold'); doc.setFontSize(11); doc.setTextColor(...dark);
    doc.text(title, M, yy);
    return yy + 8;
  };

  if (r.topExercises.length) {
    autoTable(doc, {
      startY: section('Evolução por exercício'),
      head: [['Exercício', 'Sessões', 'Volume', 'Carga máx.', 'Evolução 1RM est.']],
      body: r.topExercises.map((e) => [e.name, e.sessions, fmtVolume(e.volume), `${e.bestWeight} kg`, e.change == null ? '—' : `${e.change >= 0 ? '+' : ''}${e.change.toFixed(1)}%`]),
      theme: 'striped', styles: { font: 'courier', fontSize: 8.5, cellPadding: 4 }, headStyles: { fillColor: dark, textColor: 255 }, margin: { left: M, right: M },
    });
  }
  if (r.muscles.length) {
    autoTable(doc, {
      startY: section('Séries por grupo muscular'),
      head: [['Grupo', 'Séries']],
      body: r.muscles.map((m) => [m.group, m.sets]),
      theme: 'striped', styles: { font: 'courier', fontSize: 8.5, cellPadding: 4 }, headStyles: { fillColor: dark, textColor: 255 }, margin: { left: M, right: M },
    });
  }
  const recs = r.records.filter((x) => x.date >= r.from && x.date <= r.to);
  if (recs.length) {
    autoTable(doc, {
      startY: section('Recordes pessoais no período'),
      head: [['Data', 'Exercício', 'Recorde', 'Valor']],
      body: recs.sort((a, b) => b.date - a.date).map((x) => [fmtDate(x.date), r.exMap.get(x.exerciseId)?.namePt ?? '', RECORD_LABEL[x.type], x.type === 'maxReps' ? `${x.value} reps` : `${Math.round(x.value * 10) / 10} kg`]),
      theme: 'striped', styles: { font: 'courier', fontSize: 8.5, cellPadding: 4 }, headStyles: { fillColor: dark, textColor: 255 }, margin: { left: M, right: M },
    });
  }
  if (r.sessions.length) {
    autoTable(doc, {
      startY: section('Treinos realizados'),
      head: [['Data', 'Treino', 'Duração', 'Séries', 'Volume']],
      body: r.sessions.map((s) => [fmtDate(s.startedAt), s.name, fmtDuration(s.durationSec), s.setsDone, fmtVolume(s.volume)]),
      theme: 'striped', styles: { font: 'courier', fontSize: 8.5, cellPadding: 4 }, headStyles: { fillColor: dark, textColor: 255 }, margin: { left: M, right: M },
    });
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('courier', 'normal'); doc.setFontSize(8); doc.setTextColor(150, 150, 160);
    doc.text(`Setly Gym · página ${i} de ${pages}`, W / 2, doc.internal.pageSize.getHeight() - 20, { align: 'center' });
  }
  const blob = doc.output('blob');
  download(`setly-relatorio-${new Date().toISOString().slice(0, 10)}.pdf`, blob);
}

export function downloadJson(name: string, data: unknown) {
  download(name, new Blob([JSON.stringify(data)], { type: 'application/json' }));
}
