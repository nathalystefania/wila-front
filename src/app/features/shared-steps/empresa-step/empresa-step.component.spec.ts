import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EmpresaStepComponent } from './empresa-step.component';

describe('EmpresaStepComponent', () => {
  let component: EmpresaStepComponent;
  let fixture: ComponentFixture<EmpresaStepComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmpresaStepComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EmpresaStepComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
