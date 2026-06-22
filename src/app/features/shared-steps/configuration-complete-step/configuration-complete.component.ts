import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { MatIcon } from '@angular/material/icon';
import { MatButton } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import confetti from 'canvas-confetti';

import { OnboardingStateService } from '@core/state/onboarding-state.service';
import { AuthService } from '@services/auth.service';
import { MotoresService } from '@services/motores.service';
import { PlantasService } from '@services/plantas.service';

@Component({
  selector: 'app-configuration-complete',
  imports: [
    CommonModule,
    MatIcon,
    MatButton,
    MatProgressSpinnerModule,
  ],
  templateUrl: './configuration-complete.component.html',
  styleUrl: './configuration-complete.component.scss',
})
export class ConfigurationCompleteComponent implements OnInit {
  private state = inject(OnboardingStateService);
  private authService = inject(AuthService);
  private motoresService = inject(MotoresService);
  private plantasService = inject(PlantasService);
  private cdr = inject(ChangeDetectorRef);

  isLoading = true;

  plantaNombre = '—';
  userEmail = '—';
  totalMotores = 0;
  totalAnillos = 0;
  totalCarbones = 0;
  carbonesSincronizados = 0;
  carbonesSinSincronizar = 0;

  async ngOnInit() {
    const plantaId = this.state.getPlantaId();
    this.userEmail = this.authService.getUser()?.email ?? '—';

    if (!plantaId) {
      this.isLoading = false;
      return;
    }

    try {
      const [plantas, motores] = await Promise.all([
        firstValueFrom(this.plantasService.getUserPlantas()),
        firstValueFrom(this.motoresService.getMotoresByPlanta(plantaId)),
      ]);

      this.plantaNombre = plantas.find(p => p.id === plantaId)?.nombre ?? '—';
      this.totalMotores = motores.length;

      let totalAnillos = 0;
      let totalCarbones = 0;
      let sincronizados = 0;

      for (const motor of motores) {
        const anillos = await firstValueFrom(this.motoresService.getAnillosByMotor(motor.id));
        totalAnillos += anillos.length;
        for (const anillo of anillos) {
          const carbones = await firstValueFrom(this.motoresService.getCarbonesByAnillo(anillo.id));
          totalCarbones += carbones.length;
          sincronizados += carbones.filter(c => c.deveui_actual != null).length;
        }
      }

      this.totalAnillos = totalAnillos;
      this.totalCarbones = totalCarbones;
      this.carbonesSincronizados = sincronizados;
      this.carbonesSinSincronizar = totalCarbones - sincronizados;
    } catch {
      // mantener valores en 0 si la API falla
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
