// ── Graphing ──────────────────────────────────────────────────────────
// Chart.js graph creation functions for time visualization.
// createTimeGraph and createStatsGraph use DOM canvas elements.
// createModalStatsGraph is pure (takes a canvas argument).

import $ from 'jquery';
import { Chart, registerables } from 'chart.js';
import { S } from './state';

// Register the components needed for Chart.js
Chart.register(...registerables);

// Store the chart instance
let myTimeChart: Chart | null = null;
let myStatsChart: Chart | null = null;

/** Creates a Chart.js bar chart of the last 5 individual solve times in #time-graph. */
export function createTimeGraph(times: number[]) {
  const ctx = document.getElementById('timeGraph') as HTMLCanvasElement;

  // If a chart instance already exists, destroy it
  if (myTimeChart) {
    myTimeChart.destroy();
  }

  if (ctx) {
    const minTime = Math.min(...times);
    const backgroundColors = times.map((time: number) =>
      time === minTime ? 'rgba(75, 192, 192, 0.2)' : 'rgba(54, 162, 235, 0.2)'
    );
    const borderColors = times.map((time: number) =>
      time === minTime ? 'rgba(75, 192, 192, 1)' : 'rgba(54, 162, 235, 1)'
    );
    const timesInSeconds = times.map((time: number) => time / 1000);

    myTimeChart = new Chart(ctx, {
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
        aspectRatio: 1, // Ensures the canvas is square
        plugins: {
          legend: {
            display: false, // Disable the legend
          },
          title: {
            display: false, // Disable the title
          },
        },
        scales: {
          y: {
            beginAtZero: true,
          },
          x: {
            grid: {
              display: false
            },
            ticks: {
              display: false // Hide x-axis labels
            },
          },
        },
      },
    });
  }
}

function toggleGraphTimesDisplay() {
  const timesDisplay = $('#times-display');
  const graphDisplay = $('#graph-display');

  if (timesDisplay.is(':visible')) {
    timesDisplay.hide();
    if (S.showCompactGraphEnabled) {
      graphDisplay.css('display', 'flex').show();
    }
    $('#toggle-display').html('<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24"><path d="M11.75 6C7.89 6 4.75 9.14 4.75 13C4.75 16.86 7.89 20 11.75 20C15.61 20 18.75 16.86 18.75 13C18.75 9.14 15.61 6 11.75 6ZM11.75 18.5C8.72 18.5 6.25 16.03 6.25 13C6.25 9.97 8.72 7.5 11.75 7.5C14.78 7.5 17.25 9.97 17.25 13C17.25 16.03 14.78 18.5 11.75 18.5ZM8.5 4.75C8.5 4.34 8.84 4 9.25 4H14.25C14.66 4 15 4.34 15 4.75C15 5.16 14.66 5.5 14.25 5.5H9.25C8.84 5.5 8.5 5.16 8.5 4.75ZM12.5 10V13C12.5 13.41 12.16 13.75 11.75 13.75C11.34 13.75 11 13.41 11 13V10C11 9.59 11.34 9.25 11.75 9.25C12.16 9.25 12.5 9.59 12.5 10ZM19.04 8.27C18.89 8.42 18.7 8.49 18.51 8.49C18.32 8.49 18.13 8.42 17.98 8.27L16.48 6.77C16.19 6.48 16.19 6 16.48 5.71C16.77 5.42 17.25 5.42 17.54 5.71L19.04 7.21C19.33 7.5 19.33 7.98 19.04 8.27Z" fill="currentColor"/></svg>');
  } else {
    timesDisplay.show();
    graphDisplay.hide();
    $('#toggle-display').html('<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="currentColor" viewBox="-2 0 19 19"><path d="M13.55 15.256H1.45a.554.554 0 0 1-.553-.554V3.168a.554.554 0 1 1 1.108 0v10.98h11.544a.554.554 0 0 1 0 1.108zM3.121 13.02V6.888a.476.476 0 0 1 .475-.475h.786a.476.476 0 0 1 .475.475v6.132zm2.785 0V3.507a.476.476 0 0 1 .475-.475h.786a.476.476 0 0 1 .475.475v9.513zm2.785 0V6.888a.476.476 0 0 1 .475-.475h.786a.476.476 0 0 1 .475.475v6.132zm2.786 0v-2.753a.476.476 0 0 1 .475-.475h.785a.476.476 0 0 1 .475.475v2.753z"/></svg>');
  }
}

$('#toggle-display').on('click', toggleGraphTimesDisplay);
$('#alg-name-display').on('click', toggleGraphTimesDisplay);

/** Creates a Chart.js line chart showing Single, Ao5, and Ao12 trends in #stats-graph. */
export function createStatsGraph(times: number[]) {
  const ctx = document.getElementById('statsGraph') as HTMLCanvasElement;

  if (ctx) {
    const context = ctx.getContext('2d');
    if (context) {
      // Delay the calculation of the canvas dimensions - needed for the gradient to work when the graph is redrawn
      setTimeout(() => {
        const timesInSeconds = times.map((time: number) => time / 1000);

        // Calculate averages
        const ao5 = calculateTrimmedAverage(timesInSeconds, 5, 3);
        const ao12 = calculateTrimmedAverage(timesInSeconds, 12, 10);

        const canvasHeight = ctx.clientHeight || ctx.getBoundingClientRect().height;
        const gradient = context.createLinearGradient(0, 0, 0, canvasHeight);
        gradient.addColorStop(0, 'rgba(54, 162, 235, 0.6)'); // Start color
        gradient.addColorStop(1, 'rgba(54, 162, 235, 0.0)'); // End color

        // If a chart instance already exists, destroy it
        if (myStatsChart) {
          myStatsChart.destroy();
          myStatsChart = null;
        }

        myStatsChart = new Chart(ctx, {
          type: 'line',
          data: {
            labels: times.map((_, index) => `${index + 1}`),
            datasets: [
              {
                label: 'Single',
                data: timesInSeconds,
                backgroundColor: gradient, // Apply the gradient
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1,
                fill: true, // Enable fill to use the gradient
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
              legend: {
                display: true,
              },
              title: {
                display: false,
              },
            },
            scales: {
              y: {
                beginAtZero: true,
              },
              x: {
                grid: {
                  display: false
                },
                ticks: {
                  display: false // Hide x-axis labels
                },
              },
            },
          },
        });
      }, 0);
    }
  }
}

// Helper function to calculate trimmed averages
function calculateTrimmedAverage(data: number[], windowSize: number, meanSize: number): (number | null)[] {
  const averages: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < windowSize - 1) {
      averages.push(null); // Not enough data points to calculate the average
    } else {
      const window = data.slice(i - windowSize + 1, i + 1);
      const sortedWindow = [...window].sort((a, b) => a - b);
      const trimmedWindow = sortedWindow.slice(1, -1); // Remove the best and worst
      const average = trimmedWindow.reduce((sum, value) => sum + value, 0) / meanSize;
      averages.push(average);
    }
  }
  return averages;
}

/** Creates a stats graph on a specific canvas element (for the stats modal) and returns the Chart instance. */
export function createModalStatsGraph(canvas: HTMLCanvasElement, times: number[]): Chart | null {
  const context = canvas.getContext('2d');
  if (!context || times.length === 0) return null;

  const timesInSeconds = times.map((time: number) => time / 1000);
  const ao5 = calculateTrimmedAverage(timesInSeconds, 5, 3);
  const ao12 = calculateTrimmedAverage(timesInSeconds, 12, 10);

  const canvasHeight = canvas.clientHeight || canvas.getBoundingClientRect().height || 200;
  const gradient = context.createLinearGradient(0, 0, 0, canvasHeight);
  gradient.addColorStop(0, 'rgba(54, 162, 235, 0.6)');
  gradient.addColorStop(1, 'rgba(54, 162, 235, 0.0)');

  return new Chart(canvas, {
    type: 'line',
    data: {
      labels: times.map((_, index) => `${index + 1}`),
      datasets: [
        { label: 'Single', data: timesInSeconds, backgroundColor: gradient, borderColor: 'rgba(54, 162, 235, 1)', borderWidth: 1, fill: true },
        { label: 'Ao5', data: ao5, backgroundColor: 'rgba(255, 159, 64, 1)', borderColor: 'rgba(255, 159, 64, 1)', borderWidth: 1, fill: false },
        { label: 'Ao12', data: ao12, backgroundColor: 'rgba(75, 192, 192, 1)', borderColor: 'rgba(75, 192, 192, 1)', borderWidth: 1, fill: false },
      ],
    },
    options: {
      elements: { point: { pointStyle: 'circle' } },
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: true }, title: { display: false } },
      scales: {
        y: { beginAtZero: true },
        x: { grid: { display: false }, ticks: { display: false } },
      },
    },
  });
}
