import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewChild,
  effect,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, Subscription, takeUntil } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorIntl, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialog } from '@angular/material/dialog';

import { CompanyContextService } from '@core/state/company-context.service';
import { DashboardService } from '@services/dashboard.service';
import { MotorDashboardRow, AlarmaDetalle } from '@models/catalogo.models';
import { CustomPaginatorIntl } from '@shared/classes/custom-paginator-intl';
import { StatusProgress } from '@shared/components/status-progress/status-progress';
import { AlarmRecognitionDialog } from '@shared/components/alarm-recognition-dialog/alarm-recognition-dialog';
import { CatalogoService } from '@services/catalogo.service';
import { AlarmResolutionDialog } from '@shared/components/alarm-resolution-dialog/alarm-resolution-dialog';

export type DashboardFilter = 'all' | 'critical' | 'warning' | 'no-alarms';

@Component({
  selector: 'app-dashboard-home',
  imports: [
    CommonModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    MatButtonToggleModule,
    StatusProgress,
  ],
  templateUrl: './dashboard-home.html',
  styleUrl: './dashboard-home.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: MatPaginatorIntl, useClass: CustomPaginatorIntl }],
})
export class DashboardHome implements OnInit, AfterViewInit, OnDestroy {
[x: string]: any;
  private readonly companyContext = inject(CompanyContextService);
  private readonly dashboardService = inject(DashboardService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();
  private readonly dialog = inject(MatDialog);

  private readonly catalogoService = inject(CatalogoService);

  private dashboardSubscription?: Subscription;

  readonly displayedColumns: string[] = [
    'motor',
    'promedioLongitud',
    'porcentajeDesgaste',
    'temperaturaMaxima',
    'bateriaMinima',
    'alarmas',
    'acciones',
  ];

  readonly dataSource = new MatTableDataSource<MotorDashboardRow>([]);

  paginator?: MatPaginator;
  sort?: MatSort;

  @ViewChild(MatPaginator)
  set matPaginator(paginator: MatPaginator | undefined) {
    this.paginator = paginator;

    if (paginator) {
      this.dataSource.paginator = paginator;
    }
  }

  @ViewChild(MatSort)
  set matSort(sort: MatSort | undefined) {
    this.sort = sort;

    if (sort) {
      this.dataSource.sort = sort;
    }
  }

  currentFilter: DashboardFilter = 'all';
  totalMotores = 0;
  totalCriticos = 0;
  totalAdvertencias = 0;
  totalSinAlarmas = 0;
  totalCarbones = 0;
  totalCarbonesSincronizados = 0;
  motoresCriticos = 0;
  motoresConAdvertencias = 0;

  alarmasRecientes: AlarmaDetalle[] = [];

  loadingMotores = false;
  errorMotores = '';

  constructor() {
    effect(() => {
      const empresaId = this.companyContext.empresaId();

      this.dashboardSubscription?.unsubscribe();

      this.dataSource.data = [];
      this.errorMotores = '';

      if (!empresaId) {
        this.alarmasRecientes = [];
        this.dataSource.data = [];

        this.totalCarbones = 0;
        this.totalCarbonesSincronizados = 0;

        this.totalCriticos = 0;
        this.totalAdvertencias = 0;

        this.totalMotores = 0;
        this.motoresCriticos = 0;
        this.motoresConAdvertencias = 0;
        this.totalSinAlarmas = 0;

        this.errorMotores = 'Selecciona una empresa para visualizar sus motores.';

        this.cdr.markForCheck();
        return;
      }

      this.cargarDashboard(empresaId);
    });
  }

  ngOnInit(): void {
    // La carga ocurre en el effect.
  }

  ngAfterViewInit(): void {
    this.configurarOrdenamiento();
    this.configurarFiltro();
  }


  totalAlarmas(): number {
    return this.totalCriticos + this.totalAdvertencias;
  }

  private cargarDashboard(empresaId: string): void {
    this.loadingMotores = true;
    this.errorMotores = '';

    this.dashboardSubscription = this.dashboardService
      .getDashboardTiempoReal(empresaId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (dashboard) => {
          this.dataSource.data = [...dashboard.motores];

          this.alarmasRecientes = [...dashboard.alarmasRecientes];

          this.totalCriticos = dashboard.totalAlarmasP2;

          this.totalAdvertencias = dashboard.totalAlarmasP1;

          this.totalCarbones = dashboard.totalCarbones;

          this.totalCarbonesSincronizados = dashboard.totalCarbonesSincronizados;

          /*
           * Estos totales sirven para los filtros
           * de motores, no para las cards P1/P2.
           */
          this.calcularTotalesMotores(dashboard.motores);

          this.dataSource.filter = this.currentFilter === 'all' ? '' : this.currentFilter;

          this.loadingMotores = false;
          this.errorMotores = '';

          this.cdr.markForCheck();
        },

        error: (error) => {
          console.error('Error actualizando dashboard', error);

          /*
           * No limpiamos dataSource ni las alarmas,
           * porque puede ser un 502 temporal.
           */
          this.loadingMotores = false;

          this.errorMotores = 'No se pudieron actualizar los datos del dashboard.';

          this.cdr.markForCheck();
        },
      });
  }

  private configurarOrdenamiento(): void {
    this.dataSource.sortingDataAccessor = (
      motor: MotorDashboardRow,

      columna: string,
    ): string | number => {
      switch (columna) {
        case 'motor':
          return (motor.nombre || motor.divisionNombre).toLowerCase();

        case 'promedioLongitud':
          return this.valorOrdenable(motor.promedioLongitud);

        case 'porcentajeDesgaste':
          return this.valorOrdenable(motor.porcentajeDesgaste);

        case 'temperaturaMaxima':
          return this.valorOrdenable(motor.temperaturaMaxima);

        case 'bateriaMinima':
          return this.valorOrdenable(motor.bateriaMinima);

        case 'alarmas':
          return motor.cantidadAlarmas;

        default:
          return '';
      }
    };
  }

  private valorOrdenable(valor: number | null): number {
    return valor ?? Number.NEGATIVE_INFINITY;
  }

  verDetalle(motor: MotorDashboardRow): void {
    this.router.navigate(['/dashboard/motor', motor.motorId]);
  }

  ngOnDestroy(): void {
    this.dashboardSubscription?.unsubscribe();

    this.dataSource.data = [];
    this.alarmasRecientes = [];

    this.errorMotores = '';

    this.destroy$.next();
    this.destroy$.complete();
  }

  private configurarFiltro(): void {
    this.dataSource.filterPredicate = (motor: MotorDashboardRow, filtro: string): boolean => {
      switch (filtro) {
        case 'critical':
          return motor.alarmasCriticas > 0;

        case 'warning':
          return motor.alarmasAdvertencia > 0;

        case 'no-alarms':
          return motor.cantidadAlarmas === 0;

        default:
          return true;
      }
    };
  }

  setFilter(filter: DashboardFilter): void {
    this.currentFilter = filter;

    this.dataSource.filter = filter === 'all' ? '' : filter;

    // this.paginator?.firstPage();
  }

  private calcularTotalesMotores(motores: MotorDashboardRow[]): void {
    this.totalMotores = motores.length;

    this.motoresCriticos = motores.filter((motor) => motor.alarmasCriticas > 0).length;

    this.motoresConAdvertencias = motores.filter(
      (motor) => motor.alarmasCriticas === 0 && motor.alarmasAdvertencia > 0,
    ).length;

    this.totalSinAlarmas = motores.filter((motor) => motor.cantidadAlarmas === 0).length;
  }

  verTodasLasAlarmas(): void {
    this.router.navigate(['/alarmas']);
  }

  reconocerAlarma(alarma: AlarmaDetalle): void {
    const dialogRef = this.dialog.open(AlarmRecognitionDialog, {
      width: '50vw',
      maxWidth: 'calc(100vw - 32px)',
      data: alarma,
      autoFocus: 'first-tabbable',
      restoreFocus: true,
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((confirmado) => {
        if (!confirmado) {
          return;
        }

        this.confirmarReconocimiento(alarma);
      });
  }

  private confirmarReconocimiento(alarma: AlarmaDetalle): void {
    this.catalogoService
      .reconocerAlarma(alarma.id, 'usuario_admin')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          /*
           * Actualización inmediata de UI.
           * El próximo ciclo de polling
           * traerá el dato definitivo.
           */
          this.alarmasRecientes = this.alarmasRecientes.map((item) =>
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

          this.alarmasRecientes = this.alarmasRecientes.map((item) =>
            item.id === alarma.id
              ? {
                  ...item,
                  estado: 'Resuelta',
                  fecha_resolucion: fechaResolucion,
                }
              : item,
          );

          this.cdr.markForCheck();
        },

        error: (error) => {
          console.error('Error resolviendo alarma', error);
        },
      });
  }
}
