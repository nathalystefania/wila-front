import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, input, viewChild } from '@angular/core';
import { BarController, BarElement, CategoryScale, Chart, ChartConfiguration, Legend, LinearScale, Tooltip } from 'chart.js';
import { AnilloMotorDetalle } from '@models/catalogo.models';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

interface RingTemperatureChartItem {
  label: string;
  promedio: number | null;
  maxima: number | null;
}

@Component({
  selector: 'app-ring-temperature-chart',
  imports: [],
  templateUrl: './ring-temperature-chart.html',
  styleUrl: './ring-temperature-chart.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})

export class RingTemperatureChart {
  readonly anillos = input.required<AnilloMotorDetalle[]>();

  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('chartCanvas');

  private chart?: Chart<'bar', (number | null)[], string>;

  readonly chartData = computed<RingTemperatureChartItem[]>(() =>
    this.anillos().map((item, index) => {
      const temperaturas = item.carbones
        .map((carbon) => carbon.ultimaTelemetria?.temperatura)
        .filter(
          (value): value is number =>
            value !== null && value !== undefined && Number.isFinite(value),
        );

      return {
        label: item.anillo.identificador || `Anillo ${index + 1}`,

        promedio: this.calcularPromedio(temperaturas),

        maxima: temperaturas.length ? Math.max(...temperaturas) : null,
      };
    }),
  );

  readonly hasData = computed(() =>
    this.chartData().some((item) => item.promedio !== null || item.maxima !== null),
  );

  constructor() {
    effect(() => {
      const canvas = this.canvas()?.nativeElement;

      const data = this.chartData();

      if (!canvas || !this.hasData()) {
        return;
      }

      this.updateChart(canvas, data);
    });
  }

  private calcularPromedio(valores: number[]): number | null {
    if (!valores.length) {
      return null;
    }

    return valores.reduce((total, value) => total + value, 0) / valores.length;
  }

  private updateChart(
    canvas: HTMLCanvasElement,

    rows: RingTemperatureChartItem[],
  ): void {
    const labels = rows.map((item) => item.label);

    const promedios = rows.map((item) => item.promedio);

    const maximas = rows.map((item) => item.maxima);

    if (this.chart) {
      this.chart.data.labels = labels;

      this.chart.data.datasets[0].data = promedios;

      this.chart.data.datasets[1].data = maximas;

      this.chart.update();

      return;
    }

    const config: ChartConfiguration<'bar', (number | null)[], string> = {
      type: 'bar',

      data: {
        labels,
        datasets: [
          {
            label: 'Temperatura promedio',
            data: promedios,
            backgroundColor: this.getCssColor('--mat-sys-on-surface'),
            borderRadius: 0,
            borderSkipped: false,
            maxBarThickness: 56,
          },
          {
            label: 'Temperatura máxima',
            data: maximas,
            backgroundColor: this.getCssColor('--mat-sys-on-surface-variant'),
            borderRadius: 0,
            borderSkipped: false,
            maxBarThickness: 56,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 300,
        },
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: {
            display: true,
            labels: {
              color: this.getCssColor('--mat-sys-on-surface'),
            },
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const value = context.raw;

                if (typeof value !== 'number' || !Number.isFinite(value)) {
                  return `${context.dataset.label}: ` + 'Sin datos';
                }

                return `${context.dataset.label}: ` + `${value.toFixed(1)} °C`;
              },
            },
          },
        },

        scales: {
          x: {
            grid: {
              display: false,
            },

            ticks: {
              color: this.getCssColor('--mat-sys-on-surface'),
            },
          },

          y: {
            beginAtZero: true,

            ticks: {
              color: this.getCssColor('--mat-sys-on-surface-variant'),

              callback: (value) => `${value} °C`,
            },

            grid: {
              color: this.getCssColor('--mat-sys-outline-variant'),
            },
          },
        },
      },
    };

    this.chart = new Chart(canvas, config);
  }

  private getCssColor(variable: string): string {
    return (
      getComputedStyle(document.documentElement).getPropertyValue(variable).trim() || 'currentColor'
    );
  }
}
