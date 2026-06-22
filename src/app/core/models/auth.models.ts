export interface AuthResponse {
    email: string;
    token: string;
    user_id: number;
}

export interface AuthCredentials {
    email: string;
    password: string;
}