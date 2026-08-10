import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { DecimalPipe } from '@angular/common';

export type StatusProgressState = 'normal' | 'advertencia' | 'critico' | 'sin-datos';

@Component({
  selector: 'app-status-progress',
  imports: [DecimalPipe],
  templateUrl: './status-progress.html',
  styleUrl: './status-progress.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusProgress {
  value = input<number | null>(null);

  state = input<StatusProgressState>('sin-datos');

  label = input<string>('Porcentaje');

  unit = input<string>('%');

  compact = input<boolean>(false);

  showStatus = input<boolean>(true);

  decimals = input<string>('1.0-1');

  mode = input<'horizontal' | 'full'>('horizontal');
}
