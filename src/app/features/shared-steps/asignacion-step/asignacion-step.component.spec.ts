import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AsignacionStepComponent } from './asignacion-step.component';

describe('AsignacionStepComponent', () => {
  let component: AsignacionStepComponent;
  let fixture: ComponentFixture<AsignacionStepComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AsignacionStepComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AsignacionStepComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
