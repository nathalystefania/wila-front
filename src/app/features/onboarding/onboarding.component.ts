import { Component, ViewChild, ChangeDetectorRef, ChangeDetectionStrategy, inject, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatStepperModule, MatStepper } from '@angular/material/stepper';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSidenavModule } from '@angular/material/sidenav';
import { StepperSelectionEvent } from '@angular/cdk/stepper';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { OnboardingStep } from '@models/onboarding.models';
import { AuthStepComponent } from '../shared-steps/auth-step/auth-step.component';
import { EmpresaStepComponent } from '../shared-steps/empresa-step/empresa-step.component';
import { MotoresStepComponent } from '../shared-steps/motores-step/motores-step.component';
import { AsignacionStepComponent } from '../shared-steps/asignacion-step/asignacion-step.component';
import { ConfigurationCompleteComponent } from '../shared-steps/configuration-complete-step/configuration-complete.component';
import { AuthService } from '@services/auth.service';
import { OnboardingStateService } from '@core/state/onboarding-state.service';
import { CatalogoService } from '@services/catalogo.service';
import { CompanyContextService } from '@core/state/company-context.service';

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
export class OnboardingComponent implements OnInit, AfterViewInit {

  versionService = inject(VersionService);

  currentStep = 0;
  readonly maxStep = 4;

  loadingNext = false;
  nextError = '';
  showExplanation = false;

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
  private catalogoService = inject(CatalogoService);
  private router = inject(Router);
  private readonly companyContext = inject(CompanyContextService);

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
    const anillos = this.onboardingState.getAnillosDraft();
    const carbones = this.onboardingState.getCarbonesDraft();
    this.isMotoresStepCompleted = !!(anillos && anillos.length > 0 && carbones && carbones.length > 0);
    //if asignacionDraft isAsignacionStepCompleted = !!(this.onboardingState.getAsignacionDraft()?.length > 0);
    this.isAsignacionStepCompleted = !!(this.onboardingState.getAsignacionDraft());

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

  private syncStepStates(): void {
    this.isAuthStepCompleted = this.authService.isAuthenticated();
    this.isEmpresaStepCompleted = !!(this.onboardingState.getEmpresaDraft()?.empresaId);
    const anillos = this.onboardingState.getAnillosDraft();
    const carbones = this.onboardingState.getCarbonesDraft();
    this.isMotoresStepCompleted = !!(anillos && anillos.length > 0 && carbones && carbones.length > 0);
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
    const anillos = this.onboardingState.getAnillosDraft();
    const carbones = this.onboardingState.getCarbonesDraft();
    if (!anillos || anillos.length === 0 || !carbones || carbones.length === 0) {
      return 2;
    }

    // Si tiene motores pero no tiene asignación, ir al paso 3 (asignación)
    const asignaciones = this.onboardingState.getAsignacionDraft();
    if (!asignaciones || asignaciones.length === 0) {
      return 3;
    }

    // Si tiene todo, ir al paso 4 (revisión/siguiente)
    return 4;
  }

  back() {
    // Comportamiento normal: retroceder al paso anterior
    if (this.currentStep > 1) {
      const newStep = this.currentStep - 1;
      this.setCurrentStep(newStep);

      this.updateStepStates();
    }
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
      case 4: return this.isAsignacionStepCompleted; // Necesita tener asignación completada
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
    this.nextError = '';
    this.loadingNext = true;

    try {
      if (this.currentStep === 4) {
        await this.persistFinalDrafts();

        const empresaDraft =
          this.onboardingState.getEmpresaDraft();

        if (!empresaDraft?.empresaId) {
          throw new Error(
            'No se encontró la empresa seleccionada.'
          );
        }

        this.companyContext.setContext({
          empresaId: empresaDraft.empresaId,

          // El dashboard será por empresa completa,
          // no solamente por la división del onboarding.
          divisionId: null,
        });

        await this.router.navigate([
          '/dashboard',
        ]);

        this.onboardingState.clear();

        return;
      }

      const step = this.getActiveStep();
      if (!step) return;

      await step.commit();

      if (this.currentStep < this.maxStep) {
        const newStep = this.currentStep + 1;
        this.setCurrentStep(newStep);

        this.updateStepStates();
      }
    } catch (e: any) {
      console.error('Onboarding nextClicked error:', {
        currentStep: this.currentStep,
        message: e?.message,
        status: e?.status,
        error: e?.error,
        raw: e,
      });

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

  private async persistFinalDrafts(): Promise<void> {
    const anillos = this.onboardingState.getAnillosDraft() ?? [];
    const carbones = this.onboardingState.getCarbonesDraft() ?? [];
    const asignaciones = this.onboardingState.getAsignacionDraft() ?? [];

    if (anillos.length === 0) {
      throw new Error('No existen anillos para guardar.');
    }

    if (carbones.length === 0) {
      throw new Error('No existen carbones para guardar.');
    }

    try {
      const result = await firstValueFrom(
        this.catalogoService.guardarConfiguracionOnboarding({
          anillos,
          carbones,
          asignaciones,
        })
      );

      console.debug('Configuración guardada correctamente', result);
    } catch (error) {
      console.error('Error al guardar la configuración final:', {
        anillosCount: anillos.length,
        carbonesCount: carbones.length,
        asignacionesCount: asignaciones.length,
        error,
      });

      throw error;
    }
  }

}