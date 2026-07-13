import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { finalize, forkJoin } from 'rxjs';
import { DivisionApi, EmpresaApi } from '@models/catalogo.models';
import { CatalogoService } from '@services/catalogo.service';
import { CompanyContextService } from '@core/state/company-context.service';

@Component({
  selector: 'app-company-selector',
  standalone: true,
  imports: [
    MatFormFieldModule,
    MatSelectModule,
  ],
  templateUrl: './company-selector.html',
  styleUrls: ['./company-selector.scss'],
  changeDetection:
    ChangeDetectionStrategy.OnPush,
})
export class CompanySelectorComponent
  implements OnInit {

  private readonly catalogoService =
    inject(CatalogoService);

  private readonly companyContext =
    inject(CompanyContextService);

  private readonly cdr =
    inject(ChangeDetectorRef);

  empresas: EmpresaApi[] = [];

  empresaIdSeleccionada: string | null = null;

  loading = false;
  error = '';

  ngOnInit(): void {
    this.empresaIdSeleccionada =
      this.companyContext.empresaId();

    this.cargarEmpresasConfiguradas();
  }

  private cargarEmpresasConfiguradas(): void {
    this.loading = true;
    this.error = '';

    forkJoin({
      empresas:
        this.catalogoService.getEmpresas(),

      divisionesCompletas:
        this.catalogoService
          .getDivisionesCompletas(),
    })
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: ({
          empresas,
          divisionesCompletas,
        }) => {
          this.empresas =
            this.filtrarEmpresasConfiguradas(
              empresas,
              divisionesCompletas
            );

          this.validarEmpresaSeleccionada();

          this.cdr.markForCheck();
        },

        error: error => {
          console.error(
            'Error cargando empresas configuradas',
            error
          );

          this.error =
            'No se pudieron cargar las empresas.';

          this.cdr.markForCheck();
        },
      });
  }

  private filtrarEmpresasConfiguradas(
    empresas: EmpresaApi[],
    divisionesCompletas: DivisionApi[]
  ): EmpresaApi[] {
    const empresasConfiguradasIds =
      new Set(
        divisionesCompletas.map(
          division => division.empresa_id
        )
      );

    return empresas
      .filter(empresa =>
        empresasConfiguradasIds.has(empresa.id)
      )
      .sort((a, b) =>
        a.nombre.localeCompare(
          b.nombre,
          'es',
          {
            sensitivity: 'base',
          }
        )
      );
  }

  private validarEmpresaSeleccionada(): void {
    const seleccionActualExiste =
      this.empresas.some(
        empresa =>
          empresa.id ===
          this.empresaIdSeleccionada
      );

    if (seleccionActualExiste) {
      return;
    }

    this.empresaIdSeleccionada = null;
    this.companyContext.clearContext();
  }

  onEmpresaChange(empresaId: string): void {
    this.empresaIdSeleccionada = empresaId;

    this.companyContext.setContext({
      empresaId,
      divisionId: null,
    });
  }
}