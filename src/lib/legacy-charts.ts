import { Chart, registerables } from 'chart.js';
import { Alg } from 'cubing/alg';
import { experimentalCountMovesETM } from 'cubing/notation';

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
  // Cheap stable signature. Collisions don't matter for correctness — a miss
  // just means we do the update anyway; we mainly want to dedupe identical runs.
  return `${times.length}|${times[0] ?? ''}|${times[times.length - 1] ?? ''}`;
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

export function createStatsGraph(canvas: HTMLCanvasElement | null, times: number[]) {
  if (!canvas) {
    return;
  }

  const sig = signatureOf(times);
  if (statsChartSignature.get(canvas) === sig && statsChartByCanvas.get(canvas)) {
    return;
  }
  statsChartSignature.set(canvas, sig);

  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }

  if (times.length === 0) {
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

  const timesInSeconds = times.map((time) => time / 1000);
  const ao5 = calculateTrimmedAverage(timesInSeconds, 5, 3);
  const ao12 = calculateTrimmedAverage(timesInSeconds, 12, 10);
  const canvasHeight = canvas.clientHeight || canvas.getBoundingClientRect().height || 300;
  const gradient = context.createLinearGradient(0, 0, 0, canvasHeight);
  gradient.addColorStop(0, 'rgba(54, 162, 235, 0.6)');
  gradient.addColorStop(1, 'rgba(54, 162, 235, 0.0)');

  const existing = statsChartByCanvas.get(canvas);
  if (existing) {
    existing.data.labels = times.map((_, index) => `${index + 1}`);
    const datasets = existing.data.datasets as unknown as Array<{
      data: Array<number | null>;
      backgroundColor?: CanvasGradient | string;
    }>;
    if (datasets[0]) {
      datasets[0].data = timesInSeconds;
      datasets[0].backgroundColor = gradient;
    }
    if (datasets[1]) datasets[1].data = ao5;
    if (datasets[2]) datasets[2].data = ao12;
    existing.update('none');
    return;
  }

  const createdStats = new Chart(canvas, {
    type: 'line',
    data: {
      labels: times.map((_, index) => `${index + 1}`),
      datasets: [
        {
          label: 'Single',
          data: timesInSeconds,
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
