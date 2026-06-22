import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// Angular Material Imports
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSliderModule } from '@angular/material/slider';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatTableModule } from '@angular/material/table';
import { MatMenuModule } from '@angular/material/menu';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatBadgeModule } from '@angular/material/badge';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatSliderModule,
    MatCheckboxModule,
    MatChipsModule,
    MatTableModule,
    MatMenuModule,
    MatTabsModule,
    MatProgressBarModule,
    MatBadgeModule,
    RouterOutlet
],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  // Theme state
  protected readonly isDarkTheme = signal<boolean>(true);

  // Form states for demonstration
  protected readonly customMessage = signal<string>('Servidor central en línea');
  protected readonly primaryColor = signal<string>('cyan');
  protected readonly tertiaryColor = signal<string>('pink');
  protected readonly backupEnabled = signal<boolean>(true);
  protected readonly alertsEnabled = signal<boolean>(true);
  protected readonly maintenanceMode = signal<boolean>(false);
  protected readonly resourcesLoad = signal<number>(45);

  // Table Data
  protected readonly servers = [
    { id: 'SRV-01', name: 'Database Primary', status: 'Online', load: 34, type: 'Database' },
    { id: 'SRV-02', name: 'Auth Gateway', status: 'Online', load: 18, type: 'Auth' },
    { id: 'SRV-03', name: 'API Cache Node', status: 'Warning', load: 88, type: 'Cache' },
    { id: 'SRV-04', name: 'Log Collector', status: 'Offline', load: 0, type: 'System' },
  ];
  protected readonly displayedColumns = ['id', 'name', 'type', 'status', 'load', 'actions'];

  constructor() {
    // Sync UI toggle state with the document class initialized in index.html
    const hasLightThemeClass = document.documentElement.classList.contains('light-medium-contrast');
    this.isDarkTheme.set(!hasLightThemeClass);
  }

  // Toggle Theme between Dark and Light
  protected toggleTheme(): void {
    const nextTheme = this.isDarkTheme() ? 'light' : 'dark';
    this.isDarkTheme.set(!this.isDarkTheme());
    localStorage.setItem('color-scheme', nextTheme);
    
    const metaScheme = document.querySelector('meta[name="color-scheme"]');
    if (metaScheme) {
      metaScheme.setAttribute('content', nextTheme);
    }
    
    if (nextTheme === 'light') {
      document.documentElement.classList.remove('dark-medium-contrast');
      document.documentElement.classList.add('light-medium-contrast');
    } else {
      document.documentElement.classList.remove('light-medium-contrast');
      document.documentElement.classList.add('dark-medium-contrast');
    }
  }

  // Change theme colors dynamically by modifying Angular Material CSS variables
  protected updateThemeColors(paletteType: 'primary' | 'tertiary', color: string): void {
    if (paletteType === 'primary') {
      this.primaryColor.set(color);
    } else {
      this.tertiaryColor.set(color);
    }
    
    // Convert named palette selection to approximate hex for runtime override
    const colorHexes: Record<string, string> = {
      cyan: '#06b6d4',
      pink: '#ec4899',
      indigo: '#6366f1',
      violet: '#8b5cf6',
      emerald: '#10b981',
      orange: '#f97316',
      rose: '#f43f5e',
      yellow: '#eab308'
    };

    const targetHex = colorHexes[color];
    if (targetHex) {
      // Angular Material 3 uses color palettes generated from these variables
      // By changing these, we override the default primary or tertiary on the fly!
      // This is a showcase of Angular Material M3 system level variables.
      const prefix = `--mat-sys-${paletteType}`;
      document.documentElement.style.setProperty(prefix, targetHex);
      document.documentElement.style.setProperty(`${prefix}-container`, `${targetHex}33`); // 20% opacity container
    }
  }

  protected resetColors(): void {
    this.primaryColor.set('cyan');
    this.tertiaryColor.set('pink');
    document.documentElement.style.removeProperty('--mat-sys-primary');
    document.documentElement.style.removeProperty('--mat-sys-primary-container');
    document.documentElement.style.removeProperty('--mat-sys-tertiary');
    document.documentElement.style.removeProperty('--mat-sys-tertiary-container');
  }
}
