import { Component, OnInit, Output, EventEmitter, inject, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormControl, FormGroupDirective, NgForm, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription, finalize } from 'rxjs';

import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ErrorStateMatcher } from '@angular/material/core';

import { OnboardingStep } from '@models/onboarding.models';
import { OnboardingStateService } from '@core/state/onboarding-state.service';
import { CatalogoService } from '@services/catalogo.service';
import { AnillosDraft, CarbonesDraft, MotorCatalogo } from '@models/catalogo.models';
import { NextOnEnterDirective } from '@core/directives/next-on-enter.directive';

import { motorConfigValidator } from './motor-config.validator';

class GroupErrorStateMatcher implements ErrorStateMatcher {
  constructor(private readonly errorKey: string) { }

  isErrorState(control: FormControl | null, form: FormGroupDirective | NgForm | null): boolean {
    if (!control) return false;

    const parent = control.parent;
    const controlInteracted = !!(control.dirty || control.touched || form?.submitted);
    const groupInteracted = !!(parent && (parent.dirty || parent.touched || form?.submitted));

    return !!(
      (control.invalid && controlInteracted) ||
      (parent?.hasError(this.errorKey) && groupInteracted)
    );
  }
}

@Component({
  selector: 'app-motores-step',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatExpansionModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, MatListModule, MatProgressSpinnerModule, MatTabsModule, NextOnEnterDirective],
  templateUrl: './motores-step.component.html',
  styleUrl: './motores-step.component.scss',
})
export class MotoresStepComponent implements OnInit, OnDestroy, OnboardingStep {
  private fb = inject(FormBuilder);
  private state = inject(OnboardingStateService);
  private catalogoService = inject(CatalogoService);
  private cdr = inject(ChangeDetectorRef);

  @Output() etapaChange = new EventEmitter<'configuracion'>();
  @Output() stateChange = new EventEmitter<void>();

  private formSub?: Subscription;
  private loadSub?: Subscription;

  error = '';
  loadingMotores = false;
  readonly prealarmaMatcher = new GroupErrorStateMatcher('prealarmaMayorIgualInicial');
  readonly alarmaMatcher = new GroupErrorStateMatcher('alarmaMayorIgualPrealarma');
  readonly bateriaMatcher = new GroupErrorStateMatcher('bateriaAvisoInvalida');
  selectedMotorIndex = 0; // Índice del motor seleccionado en la segunda etapa
  focusedField: 'largo_inicial' | 'largo_prealarma' | 'largo_alarma' | null = 'largo_inicial'; // Campo enfocado
  motoresDisponibles: MotorCatalogo[] = [];

  formConfiguracion = this.fb.group({
    motores: this.fb.array([])
  });

  ngOnInit(): void {
    const empresaId = this.state.getEmpresaDraft()?.empresaId?.trim();
    const divisionId = this.state.getEmpresaDraft()?.divisionId?.trim() ?? '';

    if (!empresaId) {
      this.error = 'No se encontró la empresa seleccionada. Vuelve al paso anterior.';
      return;
    }

    this.loadingMotores = true;
    const anillosExistentes = this.state.getAnillosDraft() ?? [];
    const carbonesExistentes = this.state.getCarbonesDraft() ?? [];

    this.loadSub?.unsubscribe();
    this.loadSub = this.catalogoService.getMotoresByEmpresaDivision(empresaId, divisionId).pipe(
      finalize(() => {
        this.loadingMotores = false;
        this.stateChange.emit();
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: motoresApi => {
        if (motoresApi.length === 0) {
          this.error = 'No se encontraron motores para la empresa y división seleccionadas.';
          this.cdr.detectChanges();
          return;
        }

        this.motoresDisponibles = motoresApi;

        this.initConfiguracionForms(this.motoresDisponibles, anillosExistentes, carbonesExistentes);
        this.etapaChange.emit('configuracion');
        this.stateChange.emit();
        this.cdr.detectChanges();
      },
      error: () => {
        this.error = 'No se pudieron cargar los motores desde la API.';
        this.cdr.detectChanges();
      },
    });
  }

  private createAnilloTempId(
    motorId: string,
    numeroAnillo: number
  ): string {
    return `motor-${motorId}-anillo-${numeroAnillo}`;
  }

  private createCarbonTempId(
    anilloTempId: string,
    numeroCarbon: number
  ): string {
    return `${anilloTempId}-carbon-${numeroCarbon}`;
  }

  private initConfiguracionForms(motores: MotorCatalogo[], anillos: AnillosDraft[], carbones: CarbonesDraft[]) {
    this.motoresConfiguracion.clear();

    for (let i = 0; i < motores.length; i++) {
      const configForm = this.createConfiguracionForm(motores[i], anillos, carbones);
      this.motoresConfiguracion.push(configForm);
    }

    this.formSub?.unsubscribe();
    this.formSub = this.formConfiguracion.valueChanges.subscribe(() => {
      this.stateChange.emit();
    });
  }

  ngOnDestroy(): void {
    this.formSub?.unsubscribe();
    this.loadSub?.unsubscribe();
  }

  get motoresConfiguracion(): FormArray {
    return this.formConfiguracion.get('motores') as FormArray;
  }

  private createConfiguracionForm(motor: MotorCatalogo, anillos: AnillosDraft[], carbones: CarbonesDraft[]) {
    const anillosMotor = anillos.filter(item => item.motor_id === motor.id);
    const primerAnillo = anillosMotor[0];
    const carbonesPrimerAnillo = primerAnillo
      ? carbones.filter(item => item.anilloTempId === primerAnillo.tempId)
      : [];
    const primerCarbon = carbonesPrimerAnillo[0];

    return this.fb.group({
      num_anillos: [
        anillosMotor.length || null,
        [Validators.required, Validators.min(1), Validators.max(10)]
      ],

      carbones_por_anillo: [
        carbonesPrimerAnillo.length || null,
        [Validators.required, Validators.min(1), Validators.max(50)]
      ],

      largo_inicial: [
        primerCarbon?.largo_inicial ?? null,
        [Validators.required, Validators.maxLength(6)]
      ],

      largo_prealarma: [
        primerCarbon?.largo_prealarma ?? null,
        [Validators.required, Validators.maxLength(6)]
      ],

      largo_alarma: [
        primerCarbon?.largo_alarma ?? null,
        [Validators.required, Validators.maxLength(6)]
      ],

      nivel_bateria_aviso: [
        primerCarbon?.nivel_bateria_aviso ?? null,
        [Validators.required, Validators.min(0), Validators.max(100)]
      ],

      nivel_bateria_minimo: [
        primerCarbon?.nivel_bateria_minimo ?? null,
        [Validators.required, Validators.min(0), Validators.max(100)]
      ],
    },
      {
        validators: motorConfigValidator
      });
  }

  selectMotor(index: number): void {
    this.selectedMotorIndex = index;
  }

  canContinue(): boolean {
    return !this.loadingMotores && this.motoresDisponibles.length > 0 && this.formConfiguracion.valid;
  }

  async commit(): Promise<void> {
    this.error = '';

    this.formConfiguracion.markAllAsTouched();

    if (this.formConfiguracion.invalid) {
      throw new Error('INVALID_STEP');
    }

    const motoresConfig = this.motoresConfiguracion.getRawValue();

    const anillosDraft: AnillosDraft[] = [];
    const carbonesDraft: CarbonesDraft[] = [];

    this.motoresDisponibles.forEach((motor, motorIndex) => {
      const config = motoresConfig[motorIndex];

      const cantidadAnillos = Number(config.num_anillos);
      const carbonesPorAnillo = Number(config.carbones_por_anillo);

      for (
        let anilloIndex = 0;
        anilloIndex < cantidadAnillos;
        anilloIndex++
      ) {
        const numeroAnillo = anilloIndex + 1;

        const anilloTempId = this.createAnilloTempId(
          motor.id,
          numeroAnillo
        );

        const anilloDraft: AnillosDraft = {
          tempId: anilloTempId,
          identificador: `Anillo ${numeroAnillo}`,
          motor_id: motor.id,
        };

        anillosDraft.push(anilloDraft);

        for (
          let carbonIndex = 0;
          carbonIndex < carbonesPorAnillo;
          carbonIndex++
        ) {
          const numeroCarbon = carbonIndex + 1;

          const carbonTempId = this.createCarbonTempId(
            anilloTempId,
            numeroCarbon
          );

          const carbonDraft: CarbonesDraft = {
            tempId: carbonTempId,
            anilloTempId: anilloTempId,

            identificador: `Carbón ${numeroCarbon}`,

            largo_inicial: Number(config.largo_inicial),
            largo_prealarma: Number(config.largo_prealarma),
            largo_alarma: Number(config.largo_alarma),

            nivel_bateria_aviso: Number(
              config.nivel_bateria_aviso
            ),
            nivel_bateria_minimo: Number(
              config.nivel_bateria_minimo
            ),
          };

          carbonesDraft.push(carbonDraft);
        }
      }
    });

    this.state.setAnillosDraft(anillosDraft);
    this.state.setCarbonesDraft(carbonesDraft);
  }

  isMotorConfigCompleted(index: number): boolean {
    return this.motoresConfiguracion.at(index)?.valid ?? false;
  }

  onFieldFocus(fieldName: 'largo_inicial' | 'largo_prealarma' | 'largo_alarma') {
    this.focusedField = fieldName;
  }

  onNumericKeydown(event: KeyboardEvent): void {
    const allowedKeys = [
      'Backspace',
      'Delete',
      'Tab',
      'ArrowLeft',
      'ArrowRight',
      'Home',
      'End'
    ];

    if (allowedKeys.includes(event.key)) return;
    if (/^\d$/.test(event.key)) return;

    event.preventDefault();
  }

  onNumericInput(controlName: 'largo_inicial' | 'largo_prealarma' | 'largo_alarma', event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.replace(/\D+/g, '');

    if (input.value !== sanitized) {
      input.value = sanitized;
    }

    const selectedForm = this.motoresConfiguracion.at(this.selectedMotorIndex);
    selectedForm?.get(controlName)?.setValue(sanitized, { emitEvent: false });
  }

  getImageForField(): string {
    switch (this.focusedField) {
      case 'largo_inicial':
        return 'assets/images/carbon-1.png';
      case 'largo_prealarma':
        return 'assets/images/carbon-2.png';
      case 'largo_alarma':
        return 'assets/images/carbon-3.png';
      default:
        return 'assets/images/carbon-1.png';
    }
  }

  getValueForField(motorForm: any): string {
    if (!this.focusedField) return '0';
    const value = motorForm.get(this.focusedField)?.value;
    return value || '0';
  }

  getLabelForField(): string {
    switch (this.focusedField) {
      case 'largo_inicial':
        return 'Largo del carbón nuevo';
      case 'largo_prealarma':
        return 'Largo de pre alarma';
      case 'largo_alarma':
        return 'Largo mínimo de cambio';
      default:
        return 'Medida';
    }
  }

  getCssClassForField(): string {
    switch (this.focusedField) {
      case 'largo_inicial':
        return 'carbon-alto';
      case 'largo_prealarma':
        return 'carbon-prealarma';
      case 'largo_alarma':
        return 'carbon-minimo';
      default:
        return 'carbon-default';
    }
  }

}