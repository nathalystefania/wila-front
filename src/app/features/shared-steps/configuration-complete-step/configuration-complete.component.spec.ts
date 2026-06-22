import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConfigurationCompleteComponent } from './configuration-complete.component';

describe('ConfigurationCompleteComponent', () => {
  let component: ConfigurationCompleteComponent;
  let fixture: ComponentFixture<ConfigurationCompleteComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfigurationCompleteComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ConfigurationCompleteComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
