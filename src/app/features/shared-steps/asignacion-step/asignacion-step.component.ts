import { Component, OnInit, OnDestroy, Output, EventEmitter, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Subject, Observable, firstValueFrom, merge } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { takeUntil } from 'rxjs/operators';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule, MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { OnboardingStep } from '@models/onboarding.models';
import { AnillosDraft, AsignacionDraft, CarbonesApi, CarbonesDraft, MotorCatalogo, SensorApi } from '@models/catalogo.models';
import { OnboardingStateService } from '@core/state/onboarding-state.service';
import { CatalogoService } from '@services/catalogo.service';

@Component({
  selector: 'app-asignacion-step',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatTabsModule,
    MatExpansionModule,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    MatAutocompleteModule,
    MatTooltipModule,
    MatChipsModule,
    MatAutocompleteTrigger
  ],
  templateUrl: './asignacion-step.component.html',
  styleUrls: ['./asignacion-step.component.scss'],
})
export class AsignacionStepComponent implements OnInit, OnDestroy, OnboardingStep {

  displayedColumns: string[] = [
    'id',
    'identificador',
    'sensor',
    'lock'
  ];

  private cdr = inject(ChangeDetectorRef);
  private state = inject(OnboardingStateService);
  private catalogoService = inject(CatalogoService);

  @Output() stateChange = new EventEmitter<void>();

  isLoading = false;
  loadingSensores = false;
  error: string | null = null;

  motors: MotorCatalogo[] = [];
  motorAnillosMap: Map<string, AnillosDraft[]> = new Map();
  carbonesByAnilloMap: Map<string, CarbonesApi[]> = new Map();
  sensoresDisponibles: SensorApi[] = [];
  sensorSearchByCarbonId: Record<string, FormControl> = {};
  filteredSensoresByCarbonId: Record<string, Observable<SensorApi[]>> = {};
  sensorAssignmentByCarbonId: Record<string, string> = {};
  carbonEnabledById: Record<string, boolean> = {};

  private destroy$ = new Subject<void>();
  private sensorAssignmentChanged$ = new Subject<void>();

  ngOnInit() {
    this.loadMotores();
    this.loadSensoresDisponibles();
  }

  async loadMotores() {
    const empresaDraft = this.state.getEmpresaDraft();
    const anillosDraft = this.state.getAnillosDraft() ?? [];
    const carbonesDraft = this.state.getCarbonesDraft() ?? [];

    if (!empresaDraft?.empresaId || anillosDraft.length === 0 || carbonesDraft.length === 0) {
      this.error = 'No se encontraron motores configurados. Vuelve al paso anterior.';
      this.cdr.detectChanges();
      return;
    }

    this.isLoading = true;
    this.error = null;

    try {
      const motoresApi = await firstValueFrom(
        this.catalogoService.getMotoresByEmpresaDivision(
          empresaDraft.empresaId.trim(),
          empresaDraft.divisionId?.trim() ?? ''
        )
      );
      const configuredMotorIds = new Set(anillosDraft.map(anillo => anillo.motor_id));

      this.motors = motoresApi.filter(motor => configuredMotorIds.has(motor.id));
      this.buildAnillosData(anillosDraft);
      this.buildCarbonesData(carbonesDraft);
      this.restoreAsignacionDraft();

      this.stateChange.emit();
    } catch (err: any) {
      this.error = 'Error al procesar los motores.';
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  private buildAnillosData(anillosDraft: AnillosDraft[]) {
    this.motorAnillosMap.clear();

    for (const motor of this.motors) {
      this.motorAnillosMap.set(
        motor.id,
        anillosDraft.filter(anillo => anillo.motor_id === motor.id)
      );
    }
  }

  private buildCarbonesData(carbonesDraft: CarbonesDraft[]) {
    this.carbonesByAnilloMap.clear();
    this.sensorSearchByCarbonId = {};
    this.filteredSensoresByCarbonId = {};
    this.carbonEnabledById = {};

    this.motors.forEach((motor) => {
      const anillos = this.getAnillosByMotor(motor);

      anillos.forEach((anillo) => {
        const carbones: CarbonesApi[] = carbonesDraft
          .filter(carbon => carbon.anillo_id === anillo.id)
          .map(carbon => {
          const carbonId = carbon.id;
          this.carbonEnabledById[carbonId] = true;

          const formControl = new FormControl('');
          this.sensorSearchByCarbonId[carbonId] = formControl;

          formControl.valueChanges
            .pipe(takeUntil(this.destroy$))
            .subscribe(() => {
              this.stateChange.emit();
            });

          this.filteredSensoresByCarbonId[carbonId] = merge(
            formControl.valueChanges.pipe(startWith('')),
            this.sensorAssignmentChanged$.pipe(startWith(null))
          ).pipe(
            map(() => this.getAvailableSensoresForCarbon(carbonId, formControl.value ?? ''))
          );

          return {
            ...carbon,
          };
        });

        this.carbonesByAnilloMap.set(anillo.id, carbones);
      });
    });
  }

  private restoreAsignacionDraft(): void {
    const asignaciones = this.state.getAsignacionDraft() ?? [];

    for (const asignacion of asignaciones) {
      if (!this.isCarbonEnabled(asignacion.carbon_id)) {
        continue;
      }

      this.sensorAssignmentByCarbonId[asignacion.carbon_id] = asignacion.sensor_id;
      this.getSensorFormControl(asignacion.carbon_id).setValue(asignacion.sensor_id, {
        emitEvent: false,
      });
    }

    this.sensorAssignmentChanged$.next();
  }

  getCarbonesTableByAnillo(anillo: AnillosDraft): CarbonesApi[] {
    return this.carbonesByAnilloMap.get(anillo.id) ?? [];
  }

  loadSensoresDisponibles() {
    this.loadingSensores = true;
    this.catalogoService.getSensores().subscribe({
      next: (sensores) => {
        // Filtrar solo sensores disponibles. Algunos backends envian ocupado como string.
        this.sensoresDisponibles = sensores.filter(s => this.isSensorDisponible(s));
        this.loadingSensores = false;
        // Fuerza recalculo de todas las listas del autocomplete con los datos recien cargados.
        this.sensorAssignmentChanged$.next();
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingSensores = false;
        this.error = 'No se pudieron cargar los sensores desde catalogo.';
        this.cdr.detectChanges();
      },
    });
  }

  getSensorFormControl(carbonId: string): FormControl {
    if (!this.sensorSearchByCarbonId[carbonId]) {
      this.sensorSearchByCarbonId[carbonId] = new FormControl('');
      const formControl = this.sensorSearchByCarbonId[carbonId];

      formControl.valueChanges
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          this.stateChange.emit();
        });

      if (!this.isCarbonEnabled(carbonId)) {
        formControl.disable({ emitEvent: false });
      }
      this.filteredSensoresByCarbonId[carbonId] = merge(
        formControl.valueChanges.pipe(startWith('')),
        this.sensorAssignmentChanged$.pipe(startWith(null))
      ).pipe(
        map(() => this.getAvailableSensoresForCarbon(carbonId, formControl.value ?? ''))
      );
    }

    return this.sensorSearchByCarbonId[carbonId];
  }

  // Eliminar el valor seleccionado en el input
  cleanValue(carbonId: string, trigger: MatAutocompleteTrigger): void {
    this.getSensorFormControl(carbonId).setValue('');
    setTimeout(() => trigger.closePanel(), 0);
  }


  getFilteredSensores(carbonId: string): Observable<SensorApi[]> {
    return this.filteredSensoresByCarbonId[carbonId] || (this.sensoresDisponibles as any);
  }

  isCarbonEnabled(carbonId: string): boolean {
    if (this.sensorAssignmentByCarbonId[carbonId] === '0') {
      return false;
    }

    return this.carbonEnabledById[carbonId] !== false;
  }

  setCarbonEnabled(carbonId: string, enabled: boolean): void {
    this.carbonEnabledById[carbonId] = enabled;
    const control = this.getSensorFormControl(carbonId);

    if (!enabled) {
      this.sensorAssignmentByCarbonId[carbonId] = '0';
      control.setValue('', { emitEvent: false });
      control.disable({ emitEvent: false });
      this.error = null;
    } else {
      if (this.sensorAssignmentByCarbonId[carbonId] === '0') {
        delete this.sensorAssignmentByCarbonId[carbonId];
      }

      control.enable({ emitEvent: false });
      control.setValue('', { emitEvent: false });
    }

    this.sensorAssignmentChanged$.next();
    this.stateChange.emit();
    this.cdr.detectChanges();
  }

  onSensorSelected(carbonId: string, sensor: SensorApi): void {
    if (!this.isCarbonEnabled(carbonId)) {
      return;
    }

    if (!sensor) {
      // delete this.sensorAssignmentByCarbonId[carbonId];
      this.sensorAssignmentByCarbonId[carbonId] = '0';
      this.getSensorFormControl(carbonId).setValue('');
      this.sensorAssignmentChanged$.next();
      this.stateChange.emit();
      return;
    }

    if (this.isSensorAssignedToAnotherCarbon(carbonId, sensor.id_hardware)) {
      this.error = `El sensor ${sensor.id_hardware} ya está asignado a otro carbón.`;
      this.getSensorFormControl(carbonId).setValue('');
      this.cdr.detectChanges();
      return;
    }

    this.error = null;
    this.sensorAssignmentByCarbonId[carbonId] = sensor.id_hardware;
    this.getSensorFormControl(carbonId).setValue(sensor.id_hardware);
    this.sensorAssignmentChanged$.next();
    this.stateChange.emit();
  }

  onOptionSelected(carbonId: string, event: any): void {
    if (!this.isCarbonEnabled(carbonId)) {
      return;
    }

    const hardwareId = event.option.value; // Solo el string id_hardware
    const sensor = this.sensoresDisponibles.find(s => s.id_hardware === hardwareId);
    if (sensor) {
      this.onSensorSelected(carbonId, sensor);
    }
  }

  getAvailableSensoresForCarbon(carbonId: string, searchTerm: string = ''): SensorApi[] {
    if (!this.isCarbonEnabled(carbonId)) {
      return [];
    }

    const term = (searchTerm ?? '').trim().toLowerCase();
    const assignedByOthers = new Set(
      Object.entries(this.sensorAssignmentByCarbonId)
        .filter(([id]) => id !== carbonId)
        .map(([, hardwareId]) => hardwareId)
    );

    return this.sensoresDisponibles
      .filter(sensor => !assignedByOthers.has(sensor.id_hardware))
      .filter(sensor => !term || sensor.id_hardware.toLowerCase().includes(term) || sensor.nombre.toLowerCase().includes(term));
  }

  displaySensorName(sensor?: SensorApi): string {
    return sensor ? `${sensor.id_hardware}` : '';
  }

  private isSensorDisponible(sensor: SensorApi): boolean {
    const raw = (sensor as any).ocupado;

    if (typeof raw === 'boolean') {
      return raw === false;
    }

    if (typeof raw === 'number') {
      return raw === 0;
    }

    if (typeof raw === 'string') {
      const normalized = raw.trim().toLowerCase();
      return normalized === 'false' || normalized === '0' || normalized === 'no';
    }

    return !raw;
  }

  private isSensorAssignedToAnotherCarbon(carbonId: string, hardwareId: string): boolean {
    return Object.entries(this.sensorAssignmentByCarbonId)
      .some(([id, assigned]) => id !== carbonId && assigned === hardwareId);
  }

  getAnillosByMotor(motor: MotorCatalogo): AnillosDraft[] {
    return this.motorAnillosMap.get(motor.id) || [];
  }

  getAsignadosCount(anillo: AnillosDraft): number {
    // Contar cuantos carbones de este anillo tienen valor asignado en input getSensorFormControl(element.id)
    const carbones = this.getCarbonesTableByAnillo(anillo);
    return carbones.filter(carbon => {
      const control = this.getSensorFormControl(carbon.id);
      return control.value && control.value.trim() !== '';
    }).length;
  }

  getDisabledCount(anillo: AnillosDraft): number {
    // Contar cuantos carbones están bloqueados (disabled)
    const carbones = this.getCarbonesTableByAnillo(anillo);
    return carbones.filter(carbon => !this.isCarbonEnabled(carbon.id)).length;
  }

  getSinAsignarCount(anillo: AnillosDraft): number {
    // Contar cuantos carbones están habilitados pero sin sensor asignado
    const carbones = this.getCarbonesTableByAnillo(anillo);
    return carbones.filter(carbon => {
      const control = this.getSensorFormControl(carbon.id);
      return this.isCarbonEnabled(carbon.id) && (!control.value || control.value.trim() === '');
    }).length;
  }

  getTotalCarbonesCount(anillo: AnillosDraft): number {
    const carbones = this.getCarbonesTableByAnillo(anillo);

    return carbones.filter(carbon => {
      if (!this.isCarbonEnabled(carbon.id)) {
        return true;
      }

      const control = this.getSensorFormControl(carbon.id);
      return !!(control.value && String(control.value).trim() !== '');
    }).length;
  }

  onMotorTabChange(event: any) {
    // Los anillos ya están pre-generados, solo detectar cambios
    this.cdr.detectChanges();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.sensorAssignmentChanged$.complete();
  }

  private getExpectedCarbonesCount(): number {
    let total = 0;

    for (const motor of this.motors) {
      const anillos = this.getAnillosByMotor(motor);
      for (const anillo of anillos) {
        total += this.getCarbonesTableByAnillo(anillo).length;
      }
    }

    return total;
  }

  private getConfiguredCarbonesCount(): number {
    let total = 0;

    for (const motor of this.motors) {
      const anillos = this.getAnillosByMotor(motor);
      for (const anillo of anillos) {
        total += this.getTotalCarbonesCount(anillo);
      }
    }

    return total;
  }

  isConfigCompleted(motor: MotorCatalogo): boolean {
    const anillos = this.getAnillosByMotor(motor);

    if (anillos.length === 0) {
      return false;
    }

    return anillos.every(anillo => {
      const carbones = this.getCarbonesTableByAnillo(anillo);
      return carbones.every(carbon => {
        const control = this.getSensorFormControl(carbon.id);
        return !this.isCarbonEnabled(carbon.id) || (control.value && String(control.value).trim() !== '');
      });
    });
  }

  canContinue(): boolean {
    if (this.motors.length === 0) {
      return false;
    }

    const expectedCarbones = this.getExpectedCarbonesCount();
    if (expectedCarbones === 0) {
      return false;
    }

    return this.getConfiguredCarbonesCount() === expectedCarbones;
  }

  async commit(): Promise<void> {
    if (!this.canContinue()) {
      throw new Error('INVALID_STEP');
    }

    const asignaciones: AsignacionDraft[] = Object.entries(this.sensorAssignmentByCarbonId)
      .filter(([carbonId, sensorId]) => {
        // return this.isCarbonEnabled(carbonId) && !!String(sensorId).trim();
        if (!this.isCarbonEnabled(carbonId)) {
          return true;
        }

        return !!String(sensorId).trim();
      })
      .map(([carbonId, sensorId]) => ({
        carbon_id: carbonId,
        sensor_id: sensorId,
      }));

    this.state.setAsignacionDraft(asignaciones);
  }
}
