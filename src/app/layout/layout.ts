import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

import { CompanySelectorComponent } from '@shared/components/company-selector/company-selector';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatIconModule, MatButtonModule, CompanySelectorComponent],
  templateUrl: './layout.html',
  styleUrl: './layout.scss',
})
export class Layout {

  isCollapsed = false;
  
  collapseSidebar(event: Event) {
    event.preventDefault();
    const sidebar = document.querySelector('.sidebar') as HTMLElement;
    if (sidebar) {
      sidebar.classList.toggle('collapsed');
      this.isCollapsed = !this.isCollapsed;
    }
  }
}
