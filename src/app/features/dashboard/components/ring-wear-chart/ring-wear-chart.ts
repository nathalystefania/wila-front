import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  input,
  viewChild,
} from '@angular/core';
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  ChartConfiguration,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js';
import { AnilloMotorDetalle } from '@models/catalogo.models';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

type ChartState = 'normal' | 'advertencia' | 'critico' | 'sin-datos';

interface RingWearChartItem {
  label: string;
  value: number | null;
  state: ChartState;
}

@Component({
  selector: 'app-ring-wear-chart',
  imports: [],
  templateUrl: './ring-wear-chart.html',
  styleUrl: './ring-wear-chart.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RingWearChart {
  readonly anillos = input.required<AnilloMotorDetalle[]>();

  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('chartCanvas');

  private chart?: Chart<'bar', (number | null)[], string>;

  private obtenerEstadoAnillo(item: AnilloMotorDetalle): ChartState {
    const estados = item.carbones.map((carbon) => carbon.estadoDesgaste);

    if (estados.includes('critico')) {
      return 'critico';
    }

    if (estados.includes('advertencia')) {
      return 'advertencia';
    }

    if (estados.includes('normal')) {
      return 'normal';
    }

    return 'sin-datos';
  }

  private getColorForState(state: ChartState): string {
    switch (state) {
      case 'critico':
        return this.getCssColor('--color-critical');

      case 'advertencia':
        return this.getCssColor('--color-warning');

      default:
        return this.getCssColor('--mat-sys-on-surface-variant');
    }
  }

  readonly chartData = computed<RingWearChartItem[]>(() =>
    this.anillos().map((item, index) => ({
      label: item.anillo.identificador || `Anillo ${index + 1}`,

      value: this.calcularPromedioDesgaste(item),

      state: this.obtenerEstadoAnillo(item),
    })),
  );

  readonly hasData = computed(() => this.chartData().some((item) => item.value !== null));

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

  private calcularPromedioDesgaste(item: AnilloMotorDetalle): number | null {
    const valores = item.carbones
      .map((carbon) => carbon.porcentajeDesgaste)
      .filter((value): value is number => value !== null && Number.isFinite(value));

    if (!valores.length) {
      return null;
    }

    return valores.reduce((total, value) => total + value, 0) / valores.length;
  }

  private updateChart(
    canvas: HTMLCanvasElement,

    rows: RingWearChartItem[],
  ): void {
    const labels = rows.map((item) => item.label);

    const values = rows.map((item) => item.value);

    const colors = rows.map((item) => this.getColorForState(item.state));

    if (this.chart) {
      this.chart.data.labels = labels;

      this.chart.data.datasets[0].data = values;

      this.chart.data.datasets[0].backgroundColor = colors;

      this.chart.update();

      return;
    }

    const config: ChartConfiguration<'bar', (number | null)[], string> = {
      type: 'bar',

      data: {
        labels,

        datasets: [
          {
            label: 'Desgaste promedio',
            data: values,
            backgroundColor: colors,
            borderRadius: 0,
            borderSkipped: false,
            maxBarThickness: 72,
          },
        ],
      },

      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 300,
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const rawValue = context.raw;
                const value = typeof rawValue === 'number' ? rawValue : Number(rawValue);

                if (rawValue == null || !Number.isFinite(value)) {
                  return 'Sin datos';
                }

                return `Desgaste promedio: ${value.toFixed(1)} %`;
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
            min: 0,
            max: 100,
            ticks: {
              color: this.getCssColor('--mat-sys-on-surface-variant'),

              callback: (value) => `${value}%`,
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
