import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
} from "@simplewebauthn/browser";

export { browserSupportsWebAuthn };

export async function deviceHasBiometric(): Promise<boolean> {
  try {
    if (!browserSupportsWebAuthn()) return false;
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

const BIOMETRIC_KEY = "upcar_biometric_email";

export function getBiometricEmail(): string | null {
  return localStorage.getItem(BIOMETRIC_KEY);
}

export function setBiometricEmail(email: string) {
  localStorage.setItem(BIOMETRIC_KEY, email);
}

export function clearBiometricEmail() {
  localStorage.removeItem(BIOMETRIC_KEY);
}

export async function registerBiometric(token: string): Promise<boolean> {
  const optRes = await fetch("/api/auth/webauthn/register-options", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!optRes.ok) throw new Error("Erro ao obter opções de cadastro biométrico");
  const options = await optRes.json();

  const credential = await startRegistration({ optionsJSON: options });

  const verifyRes = await fetch("/api/auth/webauthn/register-verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(credential),
  });
  if (!verifyRes.ok) throw new Error("Erro ao verificar biometria");
  const result = await verifyRes.json();
  return result.verified === true;
}

export async function authenticateBiometric(email: string): Promise<{ token: string; user: any } | null> {
  const optRes = await fetch("/api/auth/webauthn/authenticate-options", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!optRes.ok) return null;
  const options = await optRes.json();

  const credential = await startAuthentication({ optionsJSON: options });

  const verifyRes = await fetch("/api/auth/webauthn/authenticate-verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, credential }),
  });
  if (!verifyRes.ok) return null;
  return verifyRes.json();
}
