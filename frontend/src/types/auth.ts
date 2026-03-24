export interface User {
  id: string;
  username: string;
  email: string;
  full_name: string;
  role: "user" | "admin";
  is_active: boolean;
  preferred_language: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}
