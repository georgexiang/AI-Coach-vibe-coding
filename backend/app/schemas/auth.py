"""Authentication request/response schemas."""

from pydantic import BaseModel, ConfigDict


class LoginRequest(BaseModel):
    """Login request with username and password."""

    username: str
    password: str


class TokenResponse(BaseModel):
    """JWT token response."""

    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    """Public user profile response."""

    id: str
    username: str
    email: str
    full_name: str
    role: str
    is_active: bool
    preferred_language: str

    model_config = ConfigDict(from_attributes=True)
