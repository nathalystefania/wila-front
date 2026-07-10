import { Component, OnDestroy, OnInit, inject, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';

import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';

import { OnboardingStep } from '@models/onboarding.models';
import { OnboardingStateService } from '@core/state/onboarding-state.service';
import { CatalogoService } from '@services/catalogo.service';
import { DivisionApi, EmpresaApi } from '@models/catalogo.models';

@Component({
  selector: 'app-empresa-step',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatSelectModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './empresa-step.component.html',
  styleUrl: './empresa-step.component.scss',
})
export class EmpresaStepComponent implements OnInit, OnDestroy, OnboardingStep {
  private fb = inject(FormBuilder);
  private state = inject(OnboardingStateService);
  private catalogoService = inject(CatalogoService);

  @Output() stateChange = new EventEmitter<void>();

  private sub?: Subscription;
  private empresaSub?: Subscription;
  private divisionesSub?: Subscription;

  error = '';
  loadingEmpresas = false;
  loadingDivisiones = false;
  empresas: EmpresaApi[] = [];
  divisiones: DivisionApi[] = [];

  form = this.fb.group({
    empresaId: ['', Validators.required],
    divisionId: ['', Validators.required],
    cantidad_motores: [1, [Validators.required, Validators.min(1), Validators.max(50)]],
  });

  ngOnInit(): void {
    const draft = this.state.getEmpresaDraft();

    if (draft) {
      this.form.patchValue({
        empresaId: draft.empresaId ?? '',
        divisionId: draft.divisionId ?? '',
      }, { emitEvent: false });
    }

    this.loadEmpresas();

    this.empresaSub = this.form.get('empresaId')?.valueChanges.subscribe(
      empresaId => {
        this.updateDivisionesByEmpresa(
          empresaId ?? ''
        );
      }
    );

    this.sub = this.form.valueChanges.subscribe(v => {
      const empresaId = (v.empresaId ?? '').trim();
      const divisionId = (v.divisionId ?? '').trim();

      if (divisionId) {
        this.state.setEmpresaDraft({ empresaId, divisionId: divisionId || null });
      }

      // Notificar cambios al componente padre
      this.stateChange.emit();
    });
  }

  private loadEmpresas(): void {
    this.loadingEmpresas = true;
    this.error = '';

    this.catalogoService.getEmpresas().subscribe({
      next: empresas => {
        this.empresas = empresas.sort((a, b) =>
          a.nombre.localeCompare(b.nombre, 'es')
        );

        const empresaActual = (this.form.get('empresaId')?.value ?? '').trim();
        if (empresaActual) {
          this.updateDivisionesByEmpresa(empresaActual);
        }
      },
      error: () => {
        this.error = 'No se pudo cargar la información de la empresa';
      },
    }).add(() => {
      this.loadingEmpresas = false;
    });
  }

  private updateDivisionesByEmpresa(empresaId: string): void {
    this.loadingDivisiones = true;

    if (!empresaId) {
      this.divisiones = [];
      this.form.get('divisionId')?.setValue('', { emitEvent: false });
      this.loadingDivisiones = false;
      return;
    }

    this.divisionesSub?.unsubscribe();
    this.divisionesSub = this.catalogoService
      .getDivisionesConMotoresByEmpresaId(empresaId)
      .subscribe({
        next: divisiones => {
          this.divisiones = divisiones;

          const divisionControl =
            this.form.get('divisionId');

          const currentDivision =
            divisionControl?.value;

          const existe =
            divisiones.some(
              d => d.id === currentDivision
            );

          if (
            currentDivision &&
            !existe
          ) {
            divisionControl?.setValue(
              '',
              { emitEvent: false }
            );
          }
        },
        error: () => {
          this.divisiones = [];
        }
      });
    
    this.divisionesSub?.add(() => {
      this.loadingDivisiones = false;
      this.stateChange.emit();
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.empresaSub?.unsubscribe();
    this.divisionesSub?.unsubscribe();
  }

  canContinue(): boolean {
    return this.form.valid && !this.loadingDivisiones && !this.loadingEmpresas;
  }

  async commit(): Promise<void> {
    this.error = '';
    this.form.markAllAsTouched();

    if (this.form.invalid) throw new Error('INVALID_STEP');

    const v = this.form.getRawValue();
    this.state.setEmpresaDraft({
      empresaId: (v.empresaId ?? '').trim(),
      divisionId: (v.divisionId ?? '').trim() || null,
    });
  }
}