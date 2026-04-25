import { Chart, registerables } from 'chart.js';
import { Alg } from 'cubing/alg';
import { experimentalCountMovesETM } from 'cubing/notation';
import type { SolveHistoryEntry } from './idb-storage';

Chart.register(...registerables);

// Instance caches keyed by canvas element so repeated calls (on every solve or
// refresh token bump) mutate the existing Chart in place instead of destroying
// and recreating it. `chart.update('none')` animates nothing, matching the
// original behavior (`animation: false`) while reusing the WebGL/2D context.
const timeChartByCanvas = new WeakMap<HTMLCanvasElement, Chart>();
const statsChartByCanvas = new WeakMap<HTMLCanvasElement, Chart>();
// Track last-data signatures so we can skip work entirely when nothing changed.
const timeChartSignature = new WeakMap<HTMLCanvasElement, string>();
const statsChartSignature = new WeakMap<HTMLCanvasElement, string>();

function signatureOf(times: number[]): string {
  // Histories are capped to a small rolling window, so a full-value signature is
  // still cheap and avoids skipping redraws when only middle entries changed.
  return `${times.length}|${times.join(',')}`;
}

function signatureOfSolveHistory(entries: SolveHistoryEntry[]): string {
  return `${entries.length}|${entries.map((entry) => `${entry.executionMs}:${entry.recognitionMs ?? 'null'}:${entry.totalMs}`).join(',')}`;
}

export function countMovesETM(alg: string): number {
  return experimentalCountMovesETM(Alg.fromString(alg));
}

export function createTimeGraph(canvas: HTMLCanvasElement | null, times: number[]) {
  if (!canvas) {
    return;
  }

  const sig = signatureOf(times);
  if (timeChartSignature.get(canvas) === sig && timeChartByCanvas.get(canvas)) {
    return;
  }
  timeChartSignature.set(canvas, sig);

  if (times.length === 0) {
    const existing = timeChartByCanvas.get(canvas);
    if (existing) {
      existing.data.labels = [];
      (existing.data.datasets[0] as { data: number[] }).data = [];
      existing.update('none');
    }
    return;
  }

  const minTime = Math.min(...times);
  const backgroundColors = times.map((time) =>
    time === minTime ? 'rgba(75, 192, 192, 0.2)' : 'rgba(54, 162, 235, 0.2)',
  );
  const borderColors = times.map((time) =>
    time === minTime ? 'rgba(75, 192, 192, 1)' : 'rgba(54, 162, 235, 1)',
  );
  const timesInSeconds = times.map((time) => time / 1000);

  const existing = timeChartByCanvas.get(canvas);
  if (existing) {
    existing.data.labels = times.map((_, index) => `${index + 1}`);
    const dataset = existing.data.datasets[0] as unknown as {
      data: number[];
      backgroundColor: string[];
      borderColor: string[];
    };
    dataset.data = timesInSeconds;
    dataset.backgroundColor = backgroundColors;
    dataset.borderColor = borderColors;
    existing.update('none');
    return;
  }

  const created = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: times.map((_, index) => `${index + 1}`),
      datasets: [
        {
          label: 'Seconds',
          data: timesInSeconds,
          backgroundColor: backgroundColors,
          borderColor: borderColors,
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      animation: false,
      maintainAspectRatio: true,
      aspectRatio: 1,
      plugins: {
        legend: { display: false },
        title: { display: false },
      },
      scales: {
        y: {
          beginAtZero: true,
        },
        x: {
          grid: { display: false },
          ticks: { display: false },
        },
      },
    },
  });
  timeChartByCanvas.set(canvas, created);
}

export function resizeTimeGraph(canvas: HTMLCanvasElement | null) {
  if (!canvas) {
    return;
  }

  const chart = timeChartByCanvas.get(canvas);
  if (!chart) {
    return;
  }

  chart.resize();
  chart.update('none');
}

export function recreateTimeGraph(canvas: HTMLCanvasElement | null, times: number[]) {
  if (!canvas) {
    return;
  }

  const existing = timeChartByCanvas.get(canvas);
  if (existing) {
    existing.destroy();
    timeChartByCanvas.delete(canvas);
  }
  timeChartSignature.delete(canvas);
  createTimeGraph(canvas, times);
}

function calculateTrimmedAverage(data: number[], windowSize: number, meanSize: number): Array<number | null> {
  const averages: Array<number | null> = [];
  for (let i = 0; i < data.length; i += 1) {
    if (i < windowSize - 1) {
      averages.push(null);
    } else {
      const window = data.slice(i - windowSize + 1, i + 1);
      const sortedWindow = [...window].sort((a, b) => a - b);
      const trimmedWindow = sortedWindow.slice(1, -1);
      const average = trimmedWindow.reduce((sum, value) => sum + value, 0) / meanSize;
      averages.push(average);
    }
  }
  return averages;
}

export function buildStatsGraphSeries(solveHistory: SolveHistoryEntry[]) {
  const labels = solveHistory.map((_, index) => `${index + 1}`);
  const executionTimesInSeconds = solveHistory.map((entry) => entry.executionMs / 1000);
  const recognitionTimesInSeconds = solveHistory.map((entry) => (
    entry.recognitionMs == null ? null : entry.recognitionMs / 1000
  ));

  return {
    labels,
    executionTimesInSeconds,
    recognitionTimesInSeconds,
    ao5: calculateTrimmedAverage(executionTimesInSeconds, 5, 3),
    ao12: calculateTrimmedAverage(executionTimesInSeconds, 12, 10),
  };
}

export function createStatsGraph(canvas: HTMLCanvasElement | null, solveHistory: SolveHistoryEntry[]) {
  if (!canvas) {
    return;
  }

  const sig = signatureOfSolveHistory(solveHistory);
  if (statsChartSignature.get(canvas) === sig && statsChartByCanvas.get(canvas)) {
    return;
  }
  statsChartSignature.set(canvas, sig);

  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }

  if (solveHistory.length === 0) {
    const existing = statsChartByCanvas.get(canvas);
    if (existing) {
      existing.data.labels = [];
      for (const ds of existing.data.datasets) {
        (ds as { data: unknown[] }).data = [];
      }
      existing.update('none');
    }
    return;
  }

  const {
    labels,
    executionTimesInSeconds,
    recognitionTimesInSeconds,
    ao5,
    ao12,
  } = buildStatsGraphSeries(solveHistory);
  const canvasHeight = canvas.clientHeight || canvas.getBoundingClientRect().height || 300;
  const gradient = context.createLinearGradient(0, 0, 0, canvasHeight);
  gradient.addColorStop(0, 'rgba(54, 162, 235, 0.6)');
  gradient.addColorStop(1, 'rgba(54, 162, 235, 0.0)');

  const existing = statsChartByCanvas.get(canvas);
  if (existing) {
    existing.data.labels = labels;
    const datasets = existing.data.datasets as unknown as Array<{
      data: Array<number | null>;
      backgroundColor?: CanvasGradient | string;
    }>;
    if (datasets[0]) {
      datasets[0].data = executionTimesInSeconds;
      datasets[0].backgroundColor = gradient;
    }
    if (datasets[1]) datasets[1].data = ao5;
    if (datasets[2]) datasets[2].data = ao12;
    if (datasets[3]) datasets[3].data = recognitionTimesInSeconds;
    existing.update('none');
    return;
  }

  const createdStats = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Single',
          data: executionTimesInSeconds,
          backgroundColor: gradient,
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1,
          fill: true,
        },
        {
          label: 'Ao5',
          data: ao5,
          backgroundColor: 'rgba(255, 159, 64, 1)',
          borderColor: 'rgba(255, 159, 64, 1)',
          borderWidth: 1,
          fill: false,
        },
        {
          label: 'Ao12',
          data: ao12,
          backgroundColor: 'rgba(75, 192, 192, 1)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1,
          fill: false,
        },
        {
          label: 'Recognition',
          data: recognitionTimesInSeconds,
          backgroundColor: 'rgba(153, 102, 255, 1)',
          borderColor: 'rgba(153, 102, 255, 1)',
          borderWidth: 1,
          fill: false,
          spanGaps: true,
        },
      ],
    },
    options: {
      elements: {
        point: {
          pointStyle: 'circle',
        },
      },
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true },
        title: { display: false },
      },
      scales: {
        y: {
          beginAtZero: true,
        },
        x: {
          grid: { display: false },
          ticks: { display: false },
        },
      },
    },
  });
  statsChartByCanvas.set(canvas, createdStats);
}

export function resizeStatsGraph(canvas: HTMLCanvasElement | null) {
  if (!canvas) {
    return;
  }

  const chart = statsChartByCanvas.get(canvas);
  if (!chart) {
    return;
  }

  chart.resize();
  chart.update('none');
}

export function recreateStatsGraph(canvas: HTMLCanvasElement | null, solveHistory: SolveHistoryEntry[]) {
  if (!canvas) {
    return;
  }

  const existing = statsChartByCanvas.get(canvas);
  if (existing) {
    existing.destroy();
    statsChartByCanvas.delete(canvas);
  }
  statsChartSignature.delete(canvas);
  createStatsGraph(canvas, solveHistory);
}
