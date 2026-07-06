import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import confetti from 'canvas-confetti';

import { OnboardingStateService } from '@core/state/onboarding-state.service';
import { AuthService } from '@services/auth.service';
import { CatalogoService } from '@services/catalogo.service';

@Component({
  selector: 'app-configuration-complete',
  imports: [
    CommonModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './configuration-complete.component.html',
  styleUrl: './configuration-complete.component.scss',
})
export class ConfigurationCompleteComponent implements OnInit {
  private state = inject(OnboardingStateService);
  private authService = inject(AuthService);
  private catalogoService = inject(CatalogoService);
  private cdr = inject(ChangeDetectorRef);

  isLoading = true;

  empresaNombre = '—';
  divisionNombre = '—';
  userEmail = '—';
  totalMotores = 0;
  totalAnillos = 0;
  totalCarbones = 0;
  carbonesSincronizados = 0;
  carbonesSinSincronizar = 0;

  async ngOnInit() {
    const empresaDraft = this.state.getEmpresaDraft();
    const motores = this.state.getMotoresDraft() ?? [];
    const carbones = this.state.getCarbonesConfiguracionDraft() ?? [];
    const asignaciones = this.state.getAsignacionDraft() ?? [];
    this.userEmail = this.authService.getUser()?.email ?? '—';

    if (!empresaDraft?.empresaId) {
      this.isLoading = false;
      return;
    }

    this.totalMotores = motores.length;
    this.totalAnillos = motores.reduce((sum, motor) => sum + (Number(motor.num_anillos) || 0), 0);
    this.totalCarbones = motores.reduce((sum, motor) => {
      const anillos = Number(motor.num_anillos) || 0;
      const carbones = Number(motor.carbones_por_anillo) || 0;
      return sum + (anillos * carbones);
    }, 0);
    this.carbonesSincronizados = asignaciones.length;
    this.carbonesSinSincronizar = this.totalCarbones - this.carbonesSincronizados;

    try {
      const [empresas, divisiones] = await Promise.all([
        firstValueFrom(this.catalogoService.getEmpresas()),
        firstValueFrom(this.catalogoService.getDivisiones()),
      ]);

      this.empresaNombre = empresas.find(e => e.id === empresaDraft.empresaId)?.nombre ?? '—';
      this.divisionNombre = divisiones.find(d => d.id === empresaDraft.divisionId)?.nombre ?? '—';
    } catch {
      // mantener valores calculados localmente y nombres en fallback
    }

    this.isLoading = false;
    this.cdr.detectChanges();

    this.launchConfetti();
  }

  constructor(private router: Router) { }

  goTo(route: string) {
    this.router.navigate([route]);
  }

  launchConfetti(): void {
    const count = 100;

    const defaults: confetti.Options = {
      origin: { y: 0.65 },
      zIndex: 9999,
    };

    const fire = (particleRatio: number, opts: confetti.Options): void => {
      confetti({
        ...defaults,
        ...opts,
        particleCount: Math.floor(count * particleRatio),
      });
    };

    fire(0.25, { spread: 26, startVelocity: 55 });
    fire(0.2, { spread: 60 });
    fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
    fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
    fire(0.1, { spread: 120, startVelocity: 45 });
  }
}
