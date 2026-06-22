import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { CompanyContextService } from '@services/company-context.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss',
})
export class MainLayoutComponent {
  private readonly companyContext =
    inject(CompanyContextService);

  readonly currentCompany =
    this.companyContext.currentCompany;
}