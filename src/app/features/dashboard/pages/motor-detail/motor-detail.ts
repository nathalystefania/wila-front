import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MotorDetailService } from '@services/motor-detail.service';
import { MotorDetalle } from '@models/catalogo.models';

import { StatusProgress } from '@shared/components/status-progress/status-progress';
import { BreadcrumbStateService } from '@core/state/breadcrumb-state.service';
import { RingWearChart } from '../../components/ring-wear-chart/ring-wear-chart';
import { RingTemperatureChart } from '../../components/ring-temperature-chart/ring-temperature-chart';

@Component({
  selector: 'app-motor-detail',
  imports: [
    CommonModule,
    MatButtonModule,
    MatExpansionModule,
    MatProgressSpinnerModule,
    MatTableModule,
    StatusProgress,
    RingWearChart,
    RingTemperatureChart,
  ],
  templateUrl: './motor-detail.html',
  styleUrl: './motor-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MotorDetail implements OnInit, OnDestroy {
  private readonly breadcrumbState = inject(BreadcrumbStateService);

  private readonly route = inject(ActivatedRoute);

  private readonly location = inject(Location);

  private readonly motorDetailService = inject(MotorDetailService);

  private readonly cdr = inject(ChangeDetectorRef);

  private readonly destroy$ = new Subject<void>();

  readonly columnasCarbones = ['carbon', 'longitud', 'desgaste', 'temperatura', 'bateria', 'fecha'];

  detalle: MotorDetalle | null = null;

  loading = true;
  errorMessage = '';

  ngOnInit(): void {
    const motorId = this.route.snapshot.paramMap.get('id');

    if (!motorId) {
      this.loading = false;

      this.errorMessage = 'No se recibió el identificador del motor.';

      return;
    }

    this.cargarDetalle(motorId);
  }

  private cargarDetalle(motorId: string): void {
    this.loading = true;
    this.errorMessage = '';

    this.motorDetailService
      .getMotorDetalleTiempoReal(motorId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (detalle) => {
          /*
           * Loading solo debería desaparecer
           * en la primera respuesta.
           */
          this.loading = false;

          this.detalle = detalle;

          if (!detalle) {
            this.errorMessage = 'No se encontró el motor solicitado.';

            this.breadcrumbState.clear();

            return;
          }
          this.breadcrumbState.setDetalle(`${detalle.motor.codigo} · ${detalle.motor.nombre}`);

          this.errorMessage = '';

          this.cdr.markForCheck();
        },

        error: (error) => {
          console.error('Error cargando detalle de motor', error);

          this.loading = false;

          this.errorMessage = 'No se pudo cargar el detalle del motor.';

          this.cdr.markForCheck();
        },
      });
  }

  volver(): void {
    this.location.back();
  }

  ngOnDestroy(): void {
    this.breadcrumbState.clear();
    
    this.destroy$.next();
    this.destroy$.complete();
  }
}
