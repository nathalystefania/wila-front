import { Component, OnDestroy, OnInit, inject, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription, firstValueFrom, debounceTime, distinctUntilChanged } from 'rxjs';

import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { OnboardingStep } from '@models/onboarding.models';
import { OnboardingStateService } from '../../../core/state/onboarding-state.service';
import { AuthService } from '@services/auth.service';
import { AuthCredentials } from '@models/auth.models';

@Component({
  selector: 'app-auth-step',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatProgressSpinnerModule],
  templateUrl: './auth-step.component.html',
  styleUrl: './auth-step.component.scss',
})
export class AuthStepComponent implements OnInit, OnDestroy, OnboardingStep {
  private fb = inject(FormBuilder);
  private state = inject(OnboardingStateService);
  private auth = inject(AuthService);

  @Output() stateChange = new EventEmitter<void>();

  private sub?: Subscription;

  mode: 'register' | 'login' = 'login';
  error = '';
  loading = false;
  showPassword = false;
  showConfirmPassword = false;

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: [''],
  }, { validators: this.passwordMatchValidator.bind(this) });

  private passwordMatchValidator(group: any) {
    const mode = this.mode;
    if (mode === 'login') return null; // No validar en login
    const password = group.get('password')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { passwordsMismatch: true };
  }

  ngOnInit(): void {
    
    const draft = this.state.getAuthDraft();
    
    if (draft) {
      this.mode = draft.mode;
      this.form.patchValue({ email: draft.email }, { emitEvent: false });
    }

    // Si ya está autenticado, notificar inmediatamente
    if (this.auth.isAuthenticated()) {
      setTimeout(() => {
        this.stateChange.emit();
      }, 0);
    }

    this.sub = this.form.valueChanges.pipe(
      debounceTime(300), // Esperar 300ms antes de emitir
      distinctUntilChanged() // Solo emitir si el valor realmente cambió
    ).subscribe(v => {
      const email = (v.email ?? '').trim().toLowerCase();
      this.state.setAuthDraft({ email, mode: this.mode });
      
      // Notificar al componente padre que el estado cambió
      this.stateChange.emit();
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  toggleMode(): void {
    this.error = '';
    this.mode = this.mode === 'register' ? 'login' : 'register';
    const email = (this.form.get('email')?.value ?? '').trim().toLowerCase();
    this.state.setAuthDraft({ email, mode: this.mode });
    
    // Notificar cambio de estado al componente padre de forma asíncrona
    Promise.resolve().then(() => {
      this.stateChange.emit();
    });
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  canContinue(): boolean {
    
    // Si ya está autenticado, permitir continuar
    if (this.auth.isAuthenticated()) {
      return true;
    }
    
    if (this.loading) {
      return false;
    }
    
    // Validaciones básicas
    const email = this.form.get('email');
    const password = this.form.get('password');
    
    if (!email?.valid || !password?.valid) {
      return false;
    }
    
    // Para registro, también verificar confirmPassword
    if (this.mode === 'register') {
      const confirmPassword = this.form.get('confirmPassword');
      const hasPasswordMismatch = this.form.hasError('passwordsMismatch');
      
      if (!confirmPassword?.valid || hasPasswordMismatch) {
        return false;
      }
    }
    
    return true;
  }

  async commit(): Promise<void> {
    this.error = '';
    this.form.markAllAsTouched();

    if (this.form.invalid) throw new Error('INVALID_STEP');

    const creds: AuthCredentials = {
      email: (this.form.value.email ?? '').trim().toLowerCase(),
      password: this.form.value.password ?? '',
    };

    this.loading = true;

    try {
      if (this.mode === 'register') {
        await firstValueFrom(this.auth.register(creds));
        const loginRes = await firstValueFrom(this.auth.login(creds));
        this.auth.saveSession(loginRes);
        return;
      }

      const res = await firstValueFrom(this.auth.login(creds));
      this.auth.saveSession(res);
      return;

    } catch (err: any) {
      if (err?.name === 'TimeoutError') {
        this.error = 'La autenticación está tardando demasiado. Intenta nuevamente.';
        throw new Error('TIMEOUT');
      }

      const status = err?.status;

      if (status === 404 || status === 401) {
        this.mode = 'register';
        this.state.setAuthDraft({ email: creds.email, mode: this.mode });
        this.error = 'No tienes cuenta registrada. Crea una contraseña para continuar.';
        this.stateChange.emit();
        throw new Error('USER_NOT_FOUND');
      }

      if (status === 409) {
        this.mode = 'login';
        this.state.setAuthDraft({ email: creds.email, mode: this.mode });
        this.error = 'Este correo ya existe. Inicia sesión para continuar.';
        this.stateChange.emit();
        throw new Error('STEP_NEEDS_LOGIN');
      }

      // if (status === 401) {
      //   this.error = 'Credenciales incorrectas.';
      //   throw new Error('UNAUTHORIZED');
      // }

      this.error = err?.error?.error || err?.error?.message || 'No se pudo autenticar.';
      throw new Error('AUTH_FAILED');

    } finally {
      this.loading = false;
    }
  }
}