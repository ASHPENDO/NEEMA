export type AuthTokenResponse = {
  access_token: string;
  token_type?: string; // "bearer"
};

export type RequestCodeResponse = {
  ok?: boolean;
  message?: string;
};

export type MeResponse = {
  id: string;
  email: string;

  // Profile fields (adjust to your actual backend response; guards handle missing safely)
  name?: string | null;
  phone_number?: string | null;
  is_profile_complete?: boolean | null;

  // optional extras
  role?: string;
  tenant_id?: string | null;
};

export type UpdateMeRequest = {
  name?: string;
  phone_number?: string;
  password?: string; // optional post-login password
};
