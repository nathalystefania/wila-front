import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, finalize, takeUntil } from 'rxjs';

import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';

import { AlarmaDetalle } from '@models/catalogo.models';
import { CatalogoService } from '@services/catalogo.service';
import { CompanyContextService } from '@core/state/company-context.service';
import { AlarmRecognitionDialog } from '@shared/components/alarm-recognition-dialog/alarm-recognition-dialog';
import { AlarmResolutionDialog } from '@shared/components/alarm-resolution-dialog/alarm-resolution-dialog';

type AlarmStateFilter =
  | 'all'
  | 'Activa'
  | 'Resuelta'
  | 'Reconocida';

type AlarmDateOrder =
  | 'desc'
  | 'asc';

@Component({
  selector: 'app-alarms',
  imports: [
    CommonModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatSelectModule,
  ],
  templateUrl: './alarmas.html',
  styleUrl: './alarmas.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Alarmas implements OnDestroy {
  private readonly catalogoService = inject(CatalogoService);

  private readonly companyContext = inject(CompanyContextService);

  private readonly router = inject(Router);

  private readonly cdr = inject(ChangeDetectorRef);

  private readonly destroy$ = new Subject<void>();

  private readonly dialog = inject(MatDialog);

  readonly empresaNombre = this.companyContext.empresaNombre;

  alarmas: AlarmaDetalle[] = [];
  alarmasOriginales: AlarmaDetalle[] = [];

  filtroEstado: AlarmStateFilter = 'all';
  ordenFecha: AlarmDateOrder = 'desc';
  motorSeleccionado = 'all';

  motoresDisponibles: {
    id: string;
    nombre: string;
    codigo: string;
  }[] = [];

  loading = false;
  error = '';

  constructor() {
    effect(() => {
      const empresaId = this.companyContext.empresaId();

      if (!empresaId) {
        this.alarmas = [];

        this.error = 'Selecciona una empresa para visualizar sus alarmas.';

        this.cdr.markForCheck();
        return;
      }

      this.cargarAlarmas(empresaId);
    });
  }

  private cargarAlarmas(empresaId: string): void {
    this.loading = true;
    this.error = '';

    this.catalogoService
      .getAlarmasDetalle()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (alarmas) => {
          this.alarmasOriginales = alarmas.filter((alarma) => alarma.empresa_id === empresaId);

          const motoresMap = new Map<
            string,
            {
              id: string;
              nombre: string;
              codigo: string;
            }
          >();

          this.alarmasOriginales.forEach((alarma) => {
            if (!motoresMap.has(alarma.motor_id)) {
              motoresMap.set(alarma.motor_id, {
                id: alarma.motor_id,

                nombre: alarma.motorNombre ?? 'Motor',

                codigo: alarma.motorCodigo ?? '',
              });
            }
          });

          this.motoresDisponibles = Array.from(motoresMap.values());

          this.aplicarFiltros();

          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Error cargando alarmas', error);

          this.alarmas = [];

          this.error = 'No se pudieron cargar las alarmas.';

          this.cdr.markForCheck();
        },
      });
  }

  volverDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  verMotor(alarma: AlarmaDetalle): void {
    this.router.navigate(['/dashboard/motor', alarma.motor_id]);
  }

  private toTimestamp(fecha: string): number {
    const normalizada = fecha.replace(/(\.\d{3})\d+/, '$1');

    const timestamp = new Date(normalizada).getTime();

    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  reconocerAlarma(alarma: AlarmaDetalle): void {
    const dialogRef = this.dialog.open(AlarmRecognitionDialog, {
      width: '50vw',
      maxWidth: 'calc(100vw - 32px)',
      data: alarma,
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((confirmado) => {
        if (!confirmado) {
          return;
        }

        this.catalogoService
          .reconocerAlarma(alarma.id, 'usuario_admin')
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.alarmas = this.alarmas.map((item) =>
                item.id === alarma.id
                  ? {
                      ...item,
                      reconocida_por: 'usuario_admin',
                    }
                  : item,
              );

              this.cdr.markForCheck();
            },

            error: (error) => {
              console.error('Error reconociendo alarma', error);
            },
          });
      });
  }

  resolverAlarma(alarma: AlarmaDetalle): void {
    const dialogRef = this.dialog.open(AlarmResolutionDialog, {
      width: '50vw',
      maxWidth: 'calc(100vw - 32px)',
      data: alarma,
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((confirmado) => {
        if (!confirmado) {
          return;
        }

        this.confirmarResolucion(alarma);
      });
  }

  private confirmarResolucion(alarma: AlarmaDetalle): void {
    this.catalogoService
      .resolverAlarma(alarma.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          const fechaResolucion = new Date().toISOString();

          this.alarmasOriginales = this.alarmasOriginales.map((item) =>
            item.id === alarma.id
              ? {
                  ...item,
                  estado: 'Resuelta',
                  fecha_resolucion: fechaResolucion,
                }
              : item,
          );

          this.aplicarFiltros();

          this.cdr.markForCheck();
        },

        error: (error) => {
          console.error('Error resolviendo alarma', error);
        },
      });
  }

  private aplicarFiltros(): void {
    let resultado = [...this.alarmasOriginales];

    /* Estado */
    switch (this.filtroEstado) {
      // case 'Activa':
      //   resultado = resultado.filter((alarma) => alarma.estado === 'Activa');
      //   break;
      case 'Activa':
        resultado = resultado.filter(
          (alarma) => alarma.estado === 'Activa' && !alarma.reconocida_por,
        );
        break;

      case 'Resuelta':
        resultado = resultado.filter((alarma) => alarma.estado === 'Resuelta');
        break;

      case 'Reconocida':
        resultado = resultado.filter((alarma) =>
          Boolean(alarma.reconocida_por || alarma.reconocida_en),
        );
        break;
    }

    /* Motor */
    if (this.motorSeleccionado !== 'all') {
      resultado = resultado.filter((alarma) => alarma.motor_id === this.motorSeleccionado);
    }

    /* Fecha */
    resultado.sort((a, b) => {
      const fechaA = this.toTimestamp(a.fecha_creacion);
      const fechaB = this.toTimestamp(b.fecha_creacion);

      return this.ordenFecha === 'desc' ? fechaB - fechaA : fechaA - fechaB;
    });

    this.alarmas = resultado;
  }

  cambiarFiltroEstado(estado: AlarmStateFilter): void {
    this.filtroEstado = estado;
    this.aplicarFiltros();
    this.cdr.markForCheck();
  }

  cambiarOrdenFecha(orden: AlarmDateOrder): void {
    this.ordenFecha = orden;
    this.aplicarFiltros();
    this.cdr.markForCheck();
  }

  cambiarFiltroMotor(motorId: string): void {
    this.motorSeleccionado = motorId;
    this.aplicarFiltros();
    this.cdr.markForCheck();
  }
}
