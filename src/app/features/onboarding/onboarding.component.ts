import { Component, ViewChild, ChangeDetectorRef, ChangeDetectionStrategy, inject, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatStepperModule, MatStepper } from '@angular/material/stepper';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSidenavModule } from '@angular/material/sidenav';
import { StepperSelectionEvent } from '@angular/cdk/stepper';
import { Router } from '@angular/router';

import { OnboardingStep } from '@models/onboarding.models';
import { AuthStepComponent } from '../shared-steps/auth-step/auth-step.component';
import { EmpresaStepComponent } from '../shared-steps/empresa-step/empresa-step.component';
import { MotoresStepComponent } from '../shared-steps/motores-step/motores-step.component';
import { AsignacionStepComponent } from '../shared-steps/asignacion-step/asignacion-step.component';
import { ConfigurationCompleteComponent } from '../shared-steps/configuration-complete-step/configuration-complete.component';
import { AuthService } from '@services/auth.service';
import { OnboardingStateService } from '@core/state/onboarding-state.service';

import { VersionService } from '@services/version.service';

@Component({
  selector: 'app-onboarding',
  imports: [
    CommonModule,
    AuthStepComponent,
    EmpresaStepComponent,
    MotoresStepComponent,
    AsignacionStepComponent,
    ConfigurationCompleteComponent,
    MatStepperModule,
    MatIconModule,
    MatButtonModule,
    MatSidenavModule
  ],
  templateUrl: './onboarding.component.html',
  styleUrl: './onboarding.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OnboardingComponent implements OnInit, AfterViewInit, OnDestroy {

  versionService = inject(VersionService);
  
  currentStep = 0;
  readonly maxStep = 4;

  loadingNext = false;
  nextError = '';
  showExplanation = false;
  asignacionSubStep = 1; // Nueva propiedad para trackear etapa de motores

  // Propiedades cacheadas para evitar ExpressionChangedAfterItHasBeenCheckedError
  isAuthStepCompleted = false;
  isEmpresaStepCompleted = false;
  isMotoresStepCompleted = false;
  isAsignacionStepCompleted = false;
  isConfigurationCompleteStepCompleted = false;
  canCurrentStepContinue = false;

  private cdr = inject(ChangeDetectorRef);
  private authService = inject(AuthService);
  private onboardingState = inject(OnboardingStateService);
  private router = inject(Router);

  @ViewChild(AuthStepComponent) authStep?: AuthStepComponent;
  @ViewChild(EmpresaStepComponent) empresaStep?: EmpresaStepComponent;
  @ViewChild(MotoresStepComponent) motoresStep?: MotoresStepComponent;
  @ViewChild(AsignacionStepComponent) asignacionStep?: AsignacionStepComponent;
  @ViewChild(MatStepper) stepper?: MatStepper;


  ngOnInit() {
    // Inicializar estados de pasos de forma SÍNCRONA antes de renderizar el stepper
    // Esto evita que el stepper linear rechace selectedIndex > 0 por [completed]=false
    this.isAuthStepCompleted = this.authService.isAuthenticated();
    this.isEmpresaStepCompleted = !!(this.onboardingState.getEmpresaDraft()?.empresaId);
    const motores = this.onboardingState.getMotoresDraft();
    this.isMotoresStepCompleted = !!(motores && motores.length > 0 &&
      motores.every(m => !!m.codigo && !!m.num_anillos && !!m.carbones_por_anillo));

    const determinedStep = this.determineCurrentStep();
    this.setCurrentStep(determinedStep);
    this.updateStepStates();
  }

  ngAfterViewInit() {
    // Forzar el índice del stepper una vez que el ViewChild está disponible
    // (el binding [selectedIndex] no es suficiente con [linear]="true" en OnPush)
    Promise.resolve().then(() => {
      if (this.stepper) {
        this.stepper.selectedIndex = this.currentStep;
      }
      this.updateStepStates();
      this.forceButtonStateUpdate();
    });

    setTimeout(() => {
      if (this.areViewChildrenReady()) {
        this.updateCanContinueState();
        this.cdr.detectChanges();
      }
    }, 0);
  }

  private forceButtonStateUpdate() {
    // Primero forzar detección de cambios para asegurar que el template se renderice
    this.cdr.detectChanges();
    
    const timeouts = [0, 50, 100, 200, 500]; // Agregué timeout inmediato
    
    timeouts.forEach(delay => {
      setTimeout(() => {
        // Forzar detección de cambios antes de verificar ViewChild
        this.cdr.detectChanges();
        
        // Verificar si los ViewChild están disponibles antes de continuar
        if (!this.areViewChildrenReady()) {
          return;
        }
        
        
        // Verificación especial: si estamos en paso 0 pero ya autenticado, actualizar paso
        if (this.currentStep === 0 && this.authService.isAuthenticated()) {
          const newStep = this.determineCurrentStep();
          this.setCurrentStep(newStep);
          this.updateStepStates();
        }
        
        this.updateCanContinueState();
        this.cdr.detectChanges();
      }, delay);
    });
    
    // Verificación final después de todos los timeouts
    setTimeout(() => {
      this.cdr.detectChanges(); // Forzar detección de cambios una vez más
      
      if (!this.areViewChildrenReady()) {
        return;
      }
      
      this.updateCanContinueState();
      this.cdr.detectChanges();
    }, 1000);
  }

  private areViewChildrenReady(): boolean {
    const authReady = this.authStep !== undefined;
    const empresaReady = this.empresaStep !== undefined;
    const motoresReady = this.motoresStep !== undefined;
    const asignacionReady = this.asignacionStep !== undefined;
    
    // Al menos el componente del paso actual debe estar listo
    switch (this.currentStep) {
      case 0: return authReady;
      case 1: return empresaReady;
      case 2: return motoresReady;
      case 3: return asignacionReady;
      default: return false;
    }
  }

  ngOnDestroy() {
    // No hay interval que limpiar ahora
  }

  private syncStepStates(): void {
    this.isAuthStepCompleted = this.authService.isAuthenticated();
    this.isEmpresaStepCompleted = !!(this.onboardingState.getEmpresaDraft()?.empresaId);
    const motores = this.onboardingState.getMotoresDraft();
    this.isMotoresStepCompleted = !!(motores && motores.length > 0 &&
      motores.every(m => m.codigo !== undefined && m.num_anillos && m.carbones_por_anillo));
    this.isAsignacionStepCompleted = this.currentStep >= 4;
    this.isConfigurationCompleteStepCompleted = this.currentStep >= 4;
  }

  private updateStepStates() {
    Promise.resolve().then(() => {
      this.syncStepStates();
      this.updateCanContinueState();
      this.cdr.detectChanges();
    });
  }

  private updateCanContinueState() {
    if (this.currentStep === 4) {
      this.canCurrentStepContinue = true;
      return;
    }

    const activeStep = this.getActiveStep();
    
    if (!activeStep) {
      this.canCurrentStepContinue = false;
      return;
    }
    
    if ('canContinue' in activeStep && typeof activeStep.canContinue === 'function') {
      try {
        const canContinue = activeStep.canContinue();
        const previousState = this.canCurrentStepContinue;
        this.canCurrentStepContinue = canContinue;
        
        if (activeStep.constructor.name === 'AuthStepComponent') {
          console.log(`🔐 Auth - form valid: ${(activeStep as any).form?.valid}`);
          console.log(`🔐 Auth - loading: ${(activeStep as any).loading}`);
        }
        
      } catch (error) {
        console.error('❌ Error calling canContinue:', error);
        this.canCurrentStepContinue = false;
      }
    } else {
      console.log(`⚠️ activeStep no tiene método canContinue disponible`);
      this.canCurrentStepContinue = false;
    }
  }

  private determineCurrentStep(): number {
    // Si no está autenticado, empezar desde el paso 0
    if (!this.authService.isAuthenticated()) {
      return 0;
    }

    // Si está autenticado pero no tiene empresa draft, ir al paso 1 (empresa)
    const empresaDraft = this.onboardingState.getEmpresaDraft();
    if (!empresaDraft?.empresaId) {
      return 1;
    }

    // Si tiene empresa pero no tiene motores configurados, ir al paso 2 (motores)
    const motores = this.onboardingState.getMotoresDraft();
    if (!motores || motores.length === 0) {
      return 2;
    }

    // Si tiene motores ir al paso 3 (revisión)
    const motoresCompletos = motores.every(m => m.codigo !== undefined);
    if (!motoresCompletos) {
      return 2; // Si los motores no están completos, quedarse en el paso 2
    }
    
    // Si tiene todo, ir al paso 3 (revisión/siguiente)
    return 3;
  }

  back() {
    // Comportamiento normal: retroceder al paso anterior
    if (this.currentStep > 1) {
      const newStep = this.currentStep - 1;
      this.setCurrentStep(newStep);
      
      this.updateStepStates();
    }
  }

  // Navegar al paso de motores y abrir la configuración del motor indicado
  onEditarMotor(motorIndex: number) {
    this.setCurrentStep(2);
    this.updateStepStates();
    // Esperar a que motores-step esté disponible en el DOM tras el cambio de paso
    setTimeout(() => {
      if (this.motoresStep) {
        this.motoresStep.irAConfiguracionMotor(motorIndex);
      }
      this.cdr.detectChanges();
    }, 50);
  }

  // Método público para que los componentes puedan notificar cambios
  onStepStateChange() {
    // Forzar detección de cambios para asegurar que ViewChild estén disponibles
    this.cdr.detectChanges();
    
    // Verificar si los ViewChild están listos
    if (this.areViewChildrenReady()) {
      this.updateCanContinueState();
    } else {
      // Reintentar después de un pequeño delay
      setTimeout(() => {
        this.cdr.detectChanges();
        if (this.areViewChildrenReady()) {
          this.updateCanContinueState();
        }
        this.cdr.detectChanges();
      }, 50);
    }
    
    this.cdr.detectChanges();
  }

  // Actualiza currentStep, sincroniza estados de completitud y fuerza el stepper
  private setCurrentStep(step: number) {
    this.currentStep = step;
    this.syncStepStates();
    this.cdr.markForCheck();
    this.cdr.detectChanges();
    // Forzar selectedIndex explícitamente (el binding puede ser rechazado por linear)
    if (this.stepper && this.stepper.selectedIndex !== step) {
      this.stepper.selectedIndex = step;
    }
    setTimeout(() => this.cdr.detectChanges(), 0);
  }

  onStepChange(event: StepperSelectionEvent) {
    // Solo permitir navegación a pasos que estén disponibles
    const targetStep = event.selectedIndex;
    
    // Prevenir loop infinito - no hacer nada si ya estamos en el paso target
    if (this.currentStep === targetStep) {
      return;
    }
    
    if (this.canNavigateToStep(targetStep)) {
      this.setCurrentStep(targetStep);
      
      this.updateStepStates();
    } else {
      // Revertir al paso actual si no puede navegar
      if (this.stepper) {
        // Usar setTimeout para prevenir loop infinito
        setTimeout(() => {
          if (this.stepper) {
            this.stepper.selectedIndex = this.currentStep;
          }
        }, 0);
      }
    }
  }

  private canNavigateToStep(step: number): boolean {
    switch (step) {
      case 0: return false; // No puede ir a auth
      case 1: return this.isAuthStepCompleted; // Necesita estar autenticado
      case 2: return this.isEmpresaStepCompleted; // Necesita tener empresa
      case 3: return this.isMotoresStepCompleted; // Necesita tener revisión completada
      default: return false; // Pasos futuros no disponibles aún
    }
  }

  private getActiveStep(): OnboardingStep | null {
    switch (this.currentStep) {
      case 0: 
        const authStep = this.authStep ?? null;
        return authStep;
      case 1: 
        const empresaStep = this.empresaStep ?? null;
        return empresaStep;
      case 2: 
        const motoresStep = this.motoresStep ?? null;
        return motoresStep;
      case 3: 
        const asignacionStep = this.asignacionStep ?? null;
        return asignacionStep;
      default: 
        return null;
    }
  }

  async nextClicked() {
    if (this.currentStep === 4) {
      this.router.navigate(['/dashboard']);
      return;
    }

    const step = this.getActiveStep();
    this.nextError = '';

    if (!step) return;

    this.loadingNext = true;

    try {
      await step.commit();
      
      if (this.currentStep < this.maxStep) {
        const newStep = this.currentStep + 1;
        this.setCurrentStep(newStep);
        
        this.updateStepStates();
      }
    } catch (e: any) {
      const msg = e?.message;
      const isModeSwitch = msg === 'USER_NOT_FOUND' || msg === 'STEP_NEEDS_LOGIN';
      if (!isModeSwitch) {
        this.nextError = msg === 'INVALID_STEP'
          ? 'Completa los campos requeridos para continuar.'
          : 'No se pudo guardar este paso. Revisa tu sesión e intenta de nuevo.';
      }
    } finally {
      this.loadingNext = false;
      this.cdr.detectChanges();
    }
  }

}