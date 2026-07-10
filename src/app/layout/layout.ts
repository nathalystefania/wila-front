import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { FormBuilder } from '@angular/forms';
import { EmpresaApi } from '@core/models/catalogo.models';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatIconModule, MatButtonModule, MatSelectModule, MatFormFieldModule],
  templateUrl: './layout.html',
  styleUrl: './layout.scss',
})
export class Layout {

  private fb = inject(FormBuilder);

  isCollapsed = false;
  
  empresas: EmpresaApi[] = [];

  collapseSidebar(event: Event) {
    event.preventDefault();
    const sidebar = document.querySelector('.sidebar') as HTMLElement;
    if (sidebar) {
      sidebar.classList.toggle('collapsed');
      this.isCollapsed = !this.isCollapsed;
    }
  }
}
