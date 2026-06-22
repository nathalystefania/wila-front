import { Component, OnInit, OnDestroy, Output, EventEmitter, inject, ChangeDetectorRef, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, firstValueFrom } from 'rxjs';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { OnboardingStep } from '@models/onboarding.models';
import { MotoresService, Motor, Anillo, Carbon } from '@services/motores.service';
import { SensoresService, SensorData } from '@services/sensores.service';
import { OnboardingStateService } from '@core/state/onboarding-state.service';

@Component({
  selector: 'app-asignacion-step',
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatProgressSpinnerModule, MatIconModule],
  templateUrl: './asignacion-step.component.html',
  styleUrls: ['./asignacion-step.component.scss'],
})
export class AsignacionStepComponent implements OnInit, OnDestroy, OnboardingStep {
  private cdr = inject(ChangeDetectorRef);
  private dialog = inject(MatDialog);
  private motoresService = inject(MotoresService);
  private sensoresService = inject(SensoresService);
  private state = inject(OnboardingStateService);

  @Output() stateChange = new EventEmitter<void>();
  @Output() subStepChange = new EventEmitter<number>();

  subStep: 1 | 2 | 3 | 4 | 5 = 1;
  isLoading = false;
  error: string | null = null;

  motors: Motor[] = [];
  selectedMotor: Motor | null = null;

  anillos: Anillo[] = [];
  selectedAnillo: Anillo | null = null;

  carbones: Carbon[] = [];
  selectedCarbon: Carbon | null = null;

  // Snapshot fijo al llegar al paso 4, inmune a cambios de CD
  step4Motor: Motor | null = null;
  step4Anillo: Anillo | null = null;
  step4Carbon: Carbon | null = null;

  step5Motor: Motor | null = null;
  step5Anillo: Anillo | null = null;
  step5Carbon: Carbon | null = null;

  dispositivos: SensorData[] = [];
  loadingDispositivos = false;

  private destroy$ = new Subject<void>();
  private isDestroyed = false;

  ngOnInit() {
    // this.openAssignmentDialog();
    this.loadMotores();
  }

  openAssignmentDialog() {
    this.dialog.open(AssignmentDialogComponent, {
      minWidth: '90vw',
      height: '95vh',
      minHeight: '95vh',
      disableClose: true,
      panelClass: 'custom-assignment-dialog',
      data: {
        title: 'Sincronización de sensores',
        message: 'En este paso se vincula cada sensor con su posición exacta en el motor, considerando el anillo y el orden del carbón.'
      }
    });
  }

  async loadMotores() {
    const plantaId = this.state.getPlantaId();
    if (!plantaId) {
      this.error = 'No se encontró una planta activa.';
      this.cdr.detectChanges();
      return;
    }
    this.isLoading = true;
    this.error = null;
    this.cdr.detectChanges();
    try {
      this.motors = await firstValueFrom(this.motoresService.getMotoresByPlanta(plantaId));
    } catch (err: any) {
      this.error = 'Error al cargar los motores de la planta.';
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  selectMotor(motor: Motor) {
    this.selectedMotor = motor;
    this.avanzarAAnillos();
  }

  async avanzarAAnillos() {
    if (!this.selectedMotor) return;
    this.subStep = 2;
    this.subStepChange.emit(2);
    this.anillos = [];
    this.selectedAnillo = null;
    this.isLoading = true;
    this.error = null;
    this.cdr.detectChanges();
    try {
      this.anillos = await firstValueFrom(this.motoresService.getAnillosByMotor(this.selectedMotor.id));
    } catch (err: any) {
      this.error = 'Error al cargar los anillos del motor.';
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  selectAnillo(anillo: Anillo) {
    this.selectedAnillo = anillo;
    this.avanzarACarbones();
  }

  async avanzarACarbones() {
    if (!this.selectedAnillo) return;
    this.subStep = 3;
    this.subStepChange.emit(3);
    this.carbones = [];
    this.selectedCarbon = null;
    this.isLoading = true;
    this.error = null;
    this.cdr.detectChanges();
    try {
      this.carbones = await firstValueFrom(this.motoresService.getCarbonesByAnillo(this.selectedAnillo.id));
    } catch (err: any) {
      this.error = 'Error al cargar los carbones del anillo.';
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  selectCarbon(carbon: Carbon) {
    this.selectedCarbon = carbon;
    this.step4Motor = this.selectedMotor;
    this.step4Anillo = this.selectedAnillo;
    this.step4Carbon = carbon;
    this.cargarDispositivosDetectados();

    this.subStep = 4;
    this.cdr.detectChanges(); // renderiza paso 4 con todos los valores
    // Emitir al padre en microtask para que su cdr.detectChanges() no pisote la vista recién renderizada
    Promise.resolve().then(() => {
      this.subStepChange.emit(4);
      this.stateChange.emit();
    });
  }

  cargarDispositivosDetectados() {
    this.dispositivos = [];
    this.loadingDispositivos = true;
    this.cdr.detectChanges();
    this.sensoresService.getDispositivosDetectados().subscribe({
      next: (data) => {
        this.dispositivos = data;
        this.loadingDispositivos = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingDispositivos = false;
        this.cdr.detectChanges();
      }
    });
  }

  asignarDispositivo(deveui: string) {
    if (!this.selectedCarbon) return;
    this.isLoading = true;
    this.cdr.detectChanges();
    
    const carbonId = this.selectedCarbon.id;
    this.sensoresService.asignarSensor(carbonId, deveui).subscribe({
      next: (data) => {
        console.log('Dispositivo asignado exitosamente:', data);
        this.isLoading = false;
        this.cdr.detectChanges();
        // Avanzar al paso 5 con los datos del dispositivo asignado
        this.step5Motor = this.step4Motor;
        this.step5Anillo = this.step4Anillo;
        this.step5Carbon = this.step4Carbon;
        this.subStep = 5;
        this.subStepChange.emit(5);
        this.stateChange.emit();
      },
      error: (err) => {
        console.error('Error al asignar dispositivo:', err);
        this.error = 'Error al asignar el dispositivo. Intenta de nuevo.';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  private setSubStep(step: 1 | 2 | 3 | 4 | 5) {
    this.subStep = step;
    this.subStepChange.emit(step);
    this.cdr.detectChanges();
  }

  goTo(step: 1 | 2 | 3 | 4 | 5) {
    this.error = null;
    if (step === 1) {
      this.setSubStep(step);
    } else if (step === 2 && this.selectedMotor) {
      this.setSubStep(step);
    } else if (step === 3 && this.selectedAnillo) {
      this.setSubStep(step);
    } else if (step === 4 && this.selectedCarbon) {
      this.setSubStep(step);
    } else if (step === 5 && this.selectedCarbon) {
      this.setSubStep(step);
    } else {
      // Si no se cumplen las condiciones para volver al paso solicitado, no hacer nada
      return;
    }
  }

  reboot() {
    // Resetea todo el estado para permitir una nueva asignación desde cero
    this.selectedMotor = null;
    this.selectedAnillo = null;
    this.selectedCarbon = null;
    this.step4Motor = null;
    this.step4Anillo = null;
    this.step4Carbon = null;
    this.step5Motor = null;
    this.step5Anillo = null;
    this.step5Carbon = null;
    this.dispositivos = [];
    this.error = null;
    this.loadMotores();
    this.setSubStep(1);
  }

  ngOnDestroy() {
    this.isDestroyed = true;
    this.destroy$.next();
    this.destroy$.complete();
  }

  canContinue(): boolean {
    return this.selectedCarbon !== null;
  }

  async commit(): Promise<void> {
    if (!this.canContinue()) throw new Error('INVALID_STEP');
  }
}

@Component({
  selector: 'assignment-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule],
  templateUrl: './assignment-dialog.component.html',
  styleUrl: './assignment-dialog.component.scss'
})
export class AssignmentDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<AssignmentDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}

  onConfirm(): void {
    this.dialogRef.close(true);
  }
}
