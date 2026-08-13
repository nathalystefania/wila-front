import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class BreadcrumbStateService {
  private readonly _detalle = signal<string | null>(null);

  readonly detalle = this._detalle.asReadonly();

  setDetalle(value: string | null): void {
    this._detalle.set(value);
  }

  clear(): void {
    this._detalle.set(null);
  }
}
