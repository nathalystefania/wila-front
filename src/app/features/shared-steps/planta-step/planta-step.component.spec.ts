import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlantaStepComponent } from './planta-step.component';

describe('PlantaStepComponent', () => {
  let component: PlantaStepComponent;
  let fixture: ComponentFixture<PlantaStepComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlantaStepComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PlantaStepComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
