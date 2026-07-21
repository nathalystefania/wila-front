import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, effect, inject, } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, finalize, takeUntil, } from 'rxjs';

import { MatProgressSpinnerModule, } from '@angular/material/progress-spinner';
import { MatButtonModule, } from '@angular/material/button';

import { AlarmaApi, } from '@models/catalogo.models';
import { CatalogoService, } from '@services/catalogo.service';
import { CompanyContextService, } from '@core/state/company-context.service';

@Component({
  selector: 'app-alarms',
  imports: [
    CommonModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './alarmas.html',
  styleUrl: './alarmas.scss',
  changeDetection:
    ChangeDetectionStrategy.OnPush,
})
export class Alarmas
  implements OnDestroy {

  private readonly catalogoService =
    inject(CatalogoService);

  private readonly companyContext =
    inject(CompanyContextService);

  private readonly router =
    inject(Router);

  private readonly cdr =
    inject(ChangeDetectorRef);

  private readonly destroy$ =
    new Subject<void>();

  alarmas: AlarmaApi[] = [];

  loading = false;
  error = '';

  constructor() {
    effect(() => {
      const empresaId =
        this.companyContext.empresaId();

      if (!empresaId) {
        this.alarmas = [];

        this.error =
          'Selecciona una empresa para visualizar sus alarmas.';

        this.cdr.markForCheck();
        return;
      }

      this.cargarAlarmas(
        empresaId
      );
    });
  }

  private cargarAlarmas(
    empresaId: string
  ): void {
    this.loading = true;
    this.error = '';

    this.catalogoService
      .getAlarmas()
      .pipe(
        takeUntil(
          this.destroy$
        ),
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: alarmas => {
          this.alarmas =
            alarmas
              .filter(
                alarma =>
                  alarma.empresa_id ===
                  empresaId
              )
              .sort(
                (a, b) =>
                  this.toTimestamp(
                    b.fecha_creacion
                  ) -
                  this.toTimestamp(
                    a.fecha_creacion
                  )
              );

          this.cdr.markForCheck();
        },
        error: error => {
          console.error(
            'Error cargando alarmas',
            error
          );

          this.alarmas = [];

          this.error =
            'No se pudieron cargar las alarmas.';

          this.cdr.markForCheck();
        },
      });
  }

  volverDashboard(): void {
    this.router.navigate([
      '/dashboard',
    ]);
  }

  verMotor(
    alarma: AlarmaApi
  ): void {
    this.router.navigate([
      '/dashboard/motor',
      alarma.motor_id,
    ]);
  }

  private toTimestamp(
    fecha: string
  ): number {
    const normalizada =
      fecha.replace(
        /(\.\d{3})\d+/,
        '$1'
      );

    const timestamp =
      new Date(
        normalizada
      ).getTime();

    return Number.isFinite(
      timestamp
    )
      ? timestamp
      : 0;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}