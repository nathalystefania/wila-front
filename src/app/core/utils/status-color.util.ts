export type SemanticState = 'normal' | 'advertencia' | 'critico' | 'sin-datos';

export function getStatusCssVariable(state: SemanticState): string {
  switch (state) {
    case 'critico':
      return '--color-critical';

    case 'advertencia':
      return '--color-warning';

    default:
      return '--mat-sys-on-surface-variant';
  }
}
