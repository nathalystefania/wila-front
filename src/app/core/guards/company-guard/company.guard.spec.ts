import { ComponentFixture, TestBed } from '@angular/core/testing';

import {CompanyGuard } from './company.guard.js';

describe('CompanyGuard', () => {
  let component:CompanyGuard;
  let fixture: ComponentFixture<CompanyGuard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CompanyGuard],
    }).compileComponents();

    fixture = TestBed.createComponent(CompanyGuard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
