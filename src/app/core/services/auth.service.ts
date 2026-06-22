import { Injectable } from '@angular/core';
import { of } from 'rxjs';
import { AuthCredentials, AuthResponse } from '../models/auth.models';

const MOCK_USER: AuthResponse = {
    email: 'demo@wila.cl',
    token: 'mock-token-12345',
    user_id: 1,
};

@Injectable({ providedIn: 'root' })
export class AuthService {

    register(_data: AuthCredentials) {
        return of(MOCK_USER);
    }

    login(_data: AuthCredentials) {
        return of(MOCK_USER);
    }

    saveSession(_res: AuthResponse) {
        // mock: no-op
    }

    getToken(): string | null {
        return MOCK_USER.token;
    }

    logout() {
        // mock: no-op
    }

    isAuthenticated(): boolean {
        return true;
    }

    getUser() {
        return { email: MOCK_USER.email, userId: MOCK_USER.user_id };
    }
}