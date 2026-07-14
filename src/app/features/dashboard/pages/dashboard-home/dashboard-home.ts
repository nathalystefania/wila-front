import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, finalize, takeUntil } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorIntl, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatCheckboxModule } from '@angular/material/checkbox';

import { CompanyContextService } from '@core/state/company-context.service';
import { DashboardService } from '@services/dashboard.service';
import { MotorDashboardRow } from '@models/catalogo.models';
import { CustomPaginatorIntl } from '@shared/classes/custom-paginator-intl';

@Component({
  selector: 'app-dashboard-home',
  imports: [
    CommonModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    MatCheckboxModule,
  ],
  templateUrl: './dashboard-home.html',
  styleUrl: './dashboard-home.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: MatPaginatorIntl, useClass: CustomPaginatorIntl }
  ],
})
export class DashboardHome
  implements OnInit, AfterViewInit, OnDestroy {

  private readonly companyContext =
    inject(CompanyContextService);

  private readonly dashboardService =
    inject(DashboardService);

  private readonly router =
    inject(Router);

  private readonly cdr =
    inject(ChangeDetectorRef);

  private readonly destroy$ =
    new Subject<void>();

  readonly displayedColumns: string[] = [
    'motor',
    'promedioLongitud',
    'promedioDesgaste',
    'temperaturaMaxima',
    'bateriaMinima',
    'cantidadAlarmas',
    'acciones',
  ];

  dataSource =
    new MatTableDataSource<MotorDashboardRow>(
      []
    );

  soloCriticos = false;

  loadingMotores = false;
  errorMotores = '';

  private paginator?: MatPaginator;

  @ViewChild(MatPaginator)
  set matPaginator(paginator: MatPaginator | undefined) {
    this.paginator = paginator;

    if (paginator) {
      this.dataSource.paginator = paginator;
    }
  }

  @ViewChild(MatSort)
  set matSort(sort: MatSort | undefined) {
    if (sort) {
      this.dataSource.sort = sort;
    }
  }

  constructor() {
    effect(() => {
      const empresaId =
        this.companyContext.empresaId();

      if (!empresaId) {
        this.dataSource.data = [];
        this.errorMotores =
          'Selecciona una empresa para visualizar sus motores.';

        this.cdr.markForCheck();
        return;
      }

      this.cargarMotores(empresaId);
    });
  }

  ngOnInit(): void {
    // La carga ocurre en el effect.
  }

  ngAfterViewInit(): void {
    this.configurarOrdenamiento();
    this.configurarFiltro();
  }

  private configurarOrdenamiento(): void {
    this.dataSource.sortingDataAccessor =
      (
        motor: MotorDashboardRow,
        columna: string
      ): string | number => {
        switch (columna) {
          case 'motor':
            return motor.codigo.toLowerCase();

          case 'promedioLongitud':
            return this.valorOrdenable(
              motor.promedioLongitud
            );

          case 'promedioDesgaste':
            return this.valorOrdenable(
              motor.promedioDesgaste
            );

          case 'temperaturaMaxima':
            return this.valorOrdenable(
              motor.temperaturaMaxima
            );

          case 'bateriaMinima':
            return this.valorOrdenable(
              motor.bateriaMinima
            );

          case 'cantidadAlarmas':
            return this.valorOrdenable(
              motor.cantidadAlarmas
            );

          default:
            return '';
        }
      };
  }

  private valorOrdenable(
    valor: number | null
  ): number {
    return valor ?? Number.NEGATIVE_INFINITY;
  }

  private configurarFiltro(): void {
    this.dataSource.filterPredicate =
      (
        motor: MotorDashboardRow,
        filtro: string
      ): boolean => {
        if (filtro === 'criticos') {
          return motor.esCritico;
        }

        return true;
      };
  }

  onSoloCriticosChange(
    checked: boolean
  ): void {
    this.soloCriticos = checked;

    this.dataSource.filter =
      checked ? 'criticos' : '';

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  private cargarMotores(
    empresaId: string
  ): void {
    this.loadingMotores = true;
    this.errorMotores = '';

    this.dashboardService
      .getMotoresDashboard(empresaId)
      .pipe(
        takeUntil(this.destroy$),

        finalize(() => {
          this.loadingMotores = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: motores => {
          this.dataSource.data = motores;

          this.dataSource.filter =
            this.soloCriticos
              ? 'criticos'
              : '';

          if (this.paginator) {
            this.paginator.firstPage();
          }

          this.cdr.markForCheck();
        },

        error: error => {
          console.error(
            'Error cargando tabla de motores',
            error
          );

          this.dataSource.data = [];

          this.errorMotores =
            'No se pudieron cargar los datos de los motores.';

          this.cdr.markForCheck();
        },
      });
  }

  verDetalle(
    motor: MotorDashboardRow
  ): void {
    this.router.navigate([
      '/dashboard/motores',
      motor.motorId,
    ]);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}