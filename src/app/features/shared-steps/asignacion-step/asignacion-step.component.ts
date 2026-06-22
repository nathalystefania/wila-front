import { Component, OnInit, OnDestroy, Output, EventEmitter, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Subject, Observable, merge } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { OnboardingStep } from '@models/onboarding.models';
import { MotorDraft } from '@models/motor.models';
import { SensorApi } from '@models/catalogo.models';
import { OnboardingStateService } from '@core/state/onboarding-state.service';
import { CatalogoService } from '@services/catalogo.service';

interface Anillo {
  id: string;
  nombre: string;
  posicion: number;
}

interface Motor extends MotorDraft {
  id: string;
}

interface CarbonRow {
  numero: number;
  id: string;
}

export interface Carbones {
  anillo_id: string;
  id: string;
  numero_carbon: number;
  identificador: string;
  largo_alarma: number;
  largo_inicial: number;
  largo_prealarma: number;
  nivel_bateria_minimo: number;
}

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
  ],
  templateUrl: './asignacion-step.component.html',
  styleUrls: ['./asignacion-step.component.scss'],
})
export class AsignacionStepComponent implements OnInit, OnDestroy, OnboardingStep {

  displayedColumns: string[] = [
    'id',
    'identificador',
    'sensor',
  ];

  private cdr = inject(ChangeDetectorRef);
  private state = inject(OnboardingStateService);
  private catalogoService = inject(CatalogoService);

  @Output() stateChange = new EventEmitter<void>();

  isLoading = false;
  loadingSensores = false;
  error: string | null = null;

  motors: Motor[] = [];
  motorAnillosMap: Map<string, Anillo[]> = new Map();
  carbonesByAnilloMap: Map<string, Carbones[]> = new Map();
  sensoresDisponibles: SensorApi[] = [];
  sensorSearchByCarbonId: Record<string, FormControl> = {};
  filteredSensoresByCarbonId: Record<string, Observable<SensorApi[]>> = {};
  sensorAssignmentByCarbonId: Record<string, string> = {};

  private destroy$ = new Subject<void>();
  private sensorAssignmentChanged$ = new Subject<void>();

  ngOnInit() {
    this.loadMotores();
    this.loadSensoresDisponibles();
  }

  async loadMotores() {
    const motorsDraft = this.state.getMotoresDraft();
    
    if (!motorsDraft || motorsDraft.length === 0) {
      this.error = 'No se encontraron motores configurados. Vuelve al paso anterior.';
      this.cdr.detectChanges();
      return;
    }

    this.isLoading = true;
    this.error = null;
    
    try {
      // Convertir MotorDraft a Motor con id y generar anillos
      this.motors = motorsDraft.map((draft, index) => ({
        ...draft,
        id: draft.codigo || `motor-${index}`
      })) as Motor[];

      // Pre-generar anillos para cada motor
      this.motors.forEach(motor => {
        this.generateAnillos(motor);
      });

      this.buildCarbonesData();

      this.stateChange.emit();
    } catch (err: any) {
      this.error = 'Error al procesar los motores.';
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  private generateAnillos(motor: Motor) {
    const anillos: Anillo[] = [];
    for (let i = 0; i < motor.num_anillos; i++) {
      anillos.push({
        id: `${motor.id}-anillo-${i}`,
        nombre: `Anillo ${i + 1}`,
        posicion: i + 1
      });
    }
    this.motorAnillosMap.set(motor.id, anillos);
  }

  private buildCarbonesData() {
    const carbonIds = this.state.getCarbonIds();
    let carbonCursor = 0;

    this.carbonesByAnilloMap.clear();
    this.sensorSearchByCarbonId = {};
    this.filteredSensoresByCarbonId = {};

    this.motors.forEach((motor) => {
      const anillos = this.getAnillosByMotor(motor);
      const carbonesPorAnillo = Number(motor.carbones_por_anillo) || 0;

      anillos.forEach((anillo) => {
        const carbones: Carbones[] = Array.from({ length: carbonesPorAnillo }, (_, index) => {
          const numeroCarbon = index + 1;
          const realId = carbonIds[carbonCursor];
          carbonCursor += 1;

          const carbonId = String(realId ?? `${anillo.id}-carbon-${numeroCarbon}`);

          // Crear FormControl para este carbón
          const formControl = new FormControl('');
          this.sensorSearchByCarbonId[carbonId] = formControl;

          // Crear observable filtrado para este carbón
          // Se actualiza cuando: 1) El usuario tipea (valueChanges), 2) Se asigna un sensor en otro carbón
          this.filteredSensoresByCarbonId[carbonId] = merge(
            formControl.valueChanges.pipe(startWith('')),
            this.sensorAssignmentChanged$.pipe(startWith(null))
          ).pipe(
            map(() => this.getAvailableSensoresForCarbon(carbonId, formControl.value ?? ''))
          );

          return {
            anillo_id: anillo.id,
            id: carbonId,
            numero_carbon: numeroCarbon,
            identificador: `${motor.codigo}-A${anillo.posicion}-C${numeroCarbon}`,
            largo_inicial: Number(motor.alto_carbon_mm) || 0,
            largo_prealarma: Number(motor.prealarma_mm) || 0,
            largo_alarma: Number(motor.minimo_cambio_mm) || 0,
            nivel_bateria_minimo: 20,
          };
        });

        this.carbonesByAnilloMap.set(anillo.id, carbones);
      });
    });
  }

  getCarbonesTableByAnillo(anillo: Anillo): Carbones[] {
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
      this.filteredSensoresByCarbonId[carbonId] = merge(
        formControl.valueChanges.pipe(startWith('')),
        this.sensorAssignmentChanged$.pipe(startWith(null))
      ).pipe(
        map(() => this.getAvailableSensoresForCarbon(carbonId, formControl.value ?? ''))
      );
    }
    return this.sensorSearchByCarbonId[carbonId];
  }

  getFilteredSensores(carbonId: string): Observable<SensorApi[]> {
    return this.filteredSensoresByCarbonId[carbonId] || (this.sensoresDisponibles as any);
  }

  onSensorSelected(carbonId: string, sensor: SensorApi): void {
    if (!sensor) {
      delete this.sensorAssignmentByCarbonId[carbonId];
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
    const hardwareId = event.option.value; // Solo el string id_hardware
    const sensor = this.sensoresDisponibles.find(s => s.id_hardware === hardwareId);
    if (sensor) {
      this.onSensorSelected(carbonId, sensor);
    }
  }

  getAvailableSensoresForCarbon(carbonId: string, searchTerm: string = ''): SensorApi[] {
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
    return sensor ? `${sensor.id_hardware} - ${sensor.nombre}` : '';
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

  getAnillosByMotor(motor: Motor): Anillo[] {
    return this.motorAnillosMap.get(motor.id) || [];
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

  canContinue(): boolean {
    return this.motors.length > 0;
  }

  async commit(): Promise<void> {
    if (!this.canContinue()) throw new Error('INVALID_STEP');
  }
}
