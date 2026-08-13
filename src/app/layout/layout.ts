import { Component, DestroyRef, inject, signal } from '@angular/core';
import {
  ActivatedRoute,
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';

import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

import { CompanySelectorComponent } from '@shared/components/company-selector/company-selector';
import { TelemetryStateService } from '@core/state/telemetry-state.service';
import { BreadcrumbStateService } from '@core/state/breadcrumb-state.service';

interface BreadcrumbItem {
  label: string;
  url: string;
}

@Component({
  selector: 'app-layout',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    DatePipe,
    MatIconModule,
    MatButtonModule,
    CompanySelectorComponent,
  ],
  templateUrl: './layout.html',
  styleUrl: './layout.scss',
})
export class Layout {
  private readonly telemetryState = inject(TelemetryStateService);
  readonly ultimaMedicion = this.telemetryState.ultimaMedicion;

  isCollapsed = false;

  private readonly router = inject(Router);

  private readonly activatedRoute = inject(ActivatedRoute);

  private readonly destroyRef = inject(DestroyRef);

  private readonly breadcrumbState = inject(BreadcrumbStateService);

  readonly breadcrumbs = signal<BreadcrumbItem[]>([]);

  readonly breadcrumbDetalle = this.breadcrumbState.detalle;

  constructor() {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.construirBreadcrumbs();
      });

    this.construirBreadcrumbs();
  }

  private construirBreadcrumbs(): void {
    const breadcrumbs: BreadcrumbItem[] = [];

    let route = this.activatedRoute.root;

    let url = '';

    while (true) {
      const childRoute = route.firstChild;

      if (!childRoute) {
        break;
      }

      route = childRoute;

      const snapshot = route.snapshot;

      if (!snapshot) {
        continue;
      }

      const segmentos = snapshot.url.map((segmento) => segmento.path);

      if (segmentos.length) {
        url += '/' + segmentos.join('/');
      }

      const breadcrumb = snapshot.data['breadcrumb'];

      if (breadcrumb) {
        breadcrumbs.push({
          label: breadcrumb,
          url,
        });
      }
    }

    this.breadcrumbs.set(breadcrumbs);
  }

  collapseSidebar(event: Event): void {
    event.preventDefault();

    const sidebar = document.querySelector('.sidebar') as HTMLElement;

    if (sidebar) {
      sidebar.classList.toggle('collapsed');

      this.isCollapsed = !this.isCollapsed;
    }
  }
}
