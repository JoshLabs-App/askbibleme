export type MobileRegisterRequest = {
  email: string;
  password: string;
  name?: string;
  locale?: string;
  source?: string;
};

export type MobileLoginRequest = {
  email: string;
  password: string;
};

export type MobileAuthUser = {
  id: string;
  email: string;
  name: string;
  locale?: string | null;
  /** 账号注册时间（ISO） */
  createdAt?: string | null;
};

export type MobileRegisterResult =
  | {
      ok: true;
      schemaVersion: number;
      user: MobileAuthUser;
      sessionToken: string;
      expiresAt: string;
      nextAction: "login";
    }
  | {
      ok: false;
      schemaVersion: number;
      error: string;
      code?: string;
    };

export type MobileLoginResult =
  | {
      ok: true;
      schemaVersion: number;
      user: MobileAuthUser;
      sessionToken: string;
      expiresAt: string;
    }
  | {
      ok: false;
      schemaVersion: number;
      error: string;
      code?: string;
    };

export type MobileDeleteAccountResult =
  | { ok: true; schemaVersion: number }
  | { ok: false; schemaVersion: number; error: string; code?: string };
