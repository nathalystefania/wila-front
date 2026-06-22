import { Component, OnInit, Output, EventEmitter, inject, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription, finalize } from 'rxjs';

import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { OnboardingStep } from '@models/onboarding.models';
import { OnboardingStateService } from '@core/state/onboarding-state.service';
import { CatalogoService } from '@services/catalogo.service';
import { MotorDraft } from '@models/motor.models';

@Component({
  selector: 'app-motores-step',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatExpansionModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, MatListModule, MatProgressSpinnerModule],
  templateUrl: './motores-step.component.html',
  styleUrl: './motores-step.component.scss',
})
export class MotoresStepComponent implements OnInit, OnboardingStep {
  private fb = inject(FormBuilder);
  private state = inject(OnboardingStateService);
  private catalogoService = inject(CatalogoService);
  private cdr = inject(ChangeDetectorRef);

  @Output() etapaChange = new EventEmitter<'configuracion'>();
  @Output() stateChange = new EventEmitter<void>();

  private formSub?: Subscription;
  private loadSub?: Subscription;

  error = '';
  loading = false;
  loadingMotores = false;
  selectedMotorIndex = 0; // Índice del motor seleccionado en la segunda etapa
  focusedField: 'alto_carbon_mm' | 'prealarma_mm' | 'minimo_cambio_mm' | null = 'alto_carbon_mm'; // Campo enfocado
  motoresDisponibles: MotorDraft[] = [];

  formConfiguracion = this.fb.group({
    motores: this.fb.array([])
  });

  ngOnInit(): void {
    const empresaId = this.state.getPlantaDraft()?.empresaId?.trim();
    const divisionId = this.state.getPlantaDraft()?.divisionId?.trim() ?? '';

    if (!empresaId) {
      this.error = 'No se encontró la empresa seleccionada. Vuelve al paso anterior.';
      return;
    }

    this.loadingMotores = true;
    const existentes = this.state.getMotoresDraft();

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

        this.motoresDisponibles = motoresApi.map((motor, index) => {
          const existente = existentes.find(item => item.codigo === motor.codigo) ?? existentes[index];
          return {
            codigo: motor.codigo,
            modelo: motor.nombre,
            ubicacion: `${motor.division_id} - ${motor.area_id} - ${motor.equipo_id}`,
            descripcion: motor.equipo_id ? `Equipo ID: ${motor.equipo_id}` : null,
            num_anillos: existente?.num_anillos ?? null,
            carbones_por_anillo: existente?.carbones_por_anillo ?? null,
            alto_carbon_mm: existente?.alto_carbon_mm ?? null,
            prealarma_mm: existente?.prealarma_mm ?? null,
            minimo_cambio_mm: existente?.minimo_cambio_mm ?? null,
          } as MotorDraft;
        });

        this.state.setCantidadMotores(this.motoresDisponibles.length);
        this.initConfiguracionForms(this.motoresDisponibles);
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

  private initConfiguracionForms(motores: MotorDraft[]) {
    this.motoresConfiguracion.clear();

    for (let i = 0; i < motores.length; i++) {
      const configForm = this.createConfiguracionForm(motores[i]);
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

  private createConfiguracionForm(motor: MotorDraft) {
    return this.fb.group({
      num_anillos: [motor.num_anillos ?? null, [Validators.required, Validators.min(1), Validators.max(10)]],
      carbones_por_anillo: [motor.carbones_por_anillo ?? null, [Validators.required, Validators.min(1), Validators.max(50)]],
      alto_carbon_mm: [motor.alto_carbon_mm ?? null, [Validators.required, Validators.maxLength(6)]],
      prealarma_mm: [motor.prealarma_mm ?? null, [Validators.required, Validators.maxLength(6)]],
      minimo_cambio_mm: [motor.minimo_cambio_mm ?? null, [Validators.required, Validators.maxLength(6)]],
    });
  }

  selectMotor(index: number): void {
    this.selectedMotorIndex = index;
  }

  canContinue(): boolean {
    return !this.loading && !this.loadingMotores && this.motoresDisponibles.length > 0 && this.formConfiguracion.valid;
  }

  async commit(): Promise<void> {
    this.error = '';

    this.formConfiguracion.markAllAsTouched();

    if (this.formConfiguracion.invalid) {
      throw new Error('INVALID_STEP');
    }

    const motoresConfig = this.motoresConfiguracion.getRawValue();

    const motoresCompletos: MotorDraft[] = this.motoresDisponibles.map((motorBase, index) => {
      const config = motoresConfig[index];
      return {
        codigo: motorBase.codigo?.trim() || '',
        modelo: motorBase.modelo?.trim() || null,
        ubicacion: motorBase.ubicacion?.trim() || null,
        descripcion: motorBase.descripcion?.trim() || null,
        num_anillos: Number(config.num_anillos) || 0,
        carbones_por_anillo: Number(config.carbones_por_anillo) || 0,
        alto_carbon_mm: config.alto_carbon_mm ? Number(config.alto_carbon_mm) : null,
        prealarma_mm: config.prealarma_mm ? Number(config.prealarma_mm) : null,
        minimo_cambio_mm: config.minimo_cambio_mm ? Number(config.minimo_cambio_mm) : null,
      };
    });

    this.state.setMotoresDraft(motoresCompletos);
  }

  getMotorCodigoByIndex(index: number): string {
    const motor = this.motoresDisponibles[index];
    if (!motor) return `Motor ${index + 1}`;
    return `${motor.codigo} - ${motor.modelo ?? `Motor ${index + 1}`}`;
  }

  isMotorConfigCompleted(index: number): boolean {
    return this.motoresConfiguracion.at(index)?.valid ?? false;
  }

  panelIcon(i: number): 'ok' | 'warn' {
    return this.isMotorConfigCompleted(i) ? 'ok' : 'warn';
  }

  onFieldFocus(fieldName: 'alto_carbon_mm' | 'prealarma_mm' | 'minimo_cambio_mm') {
    this.focusedField = fieldName;
  }

  onFieldBlur() {
    // Mantener el campo enfocado o volver a alto_carbon_mm por defecto
    // this.focusedField = null; // Si quieres que no haya nada seleccionado al salir
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

  onNumericInput(controlName: 'alto_carbon_mm' | 'prealarma_mm' | 'minimo_cambio_mm', event: Event): void {
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
      case 'alto_carbon_mm':
        return 'assets/images/carbon-1.png';
      case 'prealarma_mm':
        return 'assets/images/carbon-2.png';
      case 'minimo_cambio_mm':
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
      case 'alto_carbon_mm':
        return 'Largo del carbón nuevo';
      case 'prealarma_mm':
        return 'Largo de pre alarma';
      case 'minimo_cambio_mm':
        return 'Largo mínimo de cambio';
      default:
        return 'Medida';
    }
  }

  getCssClassForField(): string {
    switch (this.focusedField) {
      case 'alto_carbon_mm':
        return 'carbon-alto';
      case 'prealarma_mm':
        return 'carbon-prealarma';
      case 'minimo_cambio_mm':
        return 'carbon-minimo';
      default:
        return 'carbon-default';
    }
  }

  // Métodos de navegación entre motores
  goToPreviousMotor(): void {
    if (this.selectedMotorIndex > 0) {
      this.selectMotor(this.selectedMotorIndex - 1);
    }
  }

  goToNextMotor(): void {
    if (this.selectedMotorIndex < this.motoresDisponibles.length - 1) {
      this.selectMotor(this.selectedMotorIndex + 1);
    }
  }

  // Métodos de validación para habilitar/deshabilitar botones
  canGoToPreviousMotor(): boolean {
    return this.selectedMotorIndex > 0;
  }

  canGoToNextMotor(): boolean {
    return this.selectedMotorIndex < this.motoresDisponibles.length - 1;
  }

  // Ir directamente a la configuración de un motor específico (llamado desde revisión)
  irAConfiguracionMotor(motorIndex: number): void {
    this.selectedMotorIndex = Math.max(0, Math.min(motorIndex, this.motoresDisponibles.length - 1));
    this.etapaChange.emit('configuracion');
    this.stateChange.emit();
  }
}