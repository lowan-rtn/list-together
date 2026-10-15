import { getCookie, setCookie } from "@tanstack/react-start/server";

const SESSION_COOKIE = "lt_session";
const SESSION_DAYS = 30;

type RuntimeEnv = Env & { OWNER_BOOTSTRAP_PASSWORD?: string };

export type Actor = { id: string; displayName: string; isOwner: boolean };

export async function runtimeEnv(): Promise<RuntimeEnv> {
  const worker = await import("cloudflare:workers");
  return worker.env as RuntimeEnv;
}

const encoder = new TextEncoder();

function toHex(value: ArrayBuffer) {
  return [...new Uint8Array(value)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string) {
  return toHex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function passwordHash(password: string, salt = randomToken()) {
  const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(salt), iterations: 120000 }, material, 256);
  return { salt, hash: toHex(bits) };
}

async function matchesPassword(password: string, salt: string, expected: string) {
  const candidate = await passwordHash(password, salt);
  const [left, right] = await Promise.all([sha256(candidate.hash), sha256(expected)]);
  return crypto.subtle.timingSafeEqual(encoder.encode(left), encoder.encode(right));
}

async function matchesSecret(provided: string, expected: string) {
  const [left, right] = await Promise.all([sha256(provided), sha256(expected)]);
  return crypto.subtle.timingSafeEqual(encoder.encode(left), encoder.encode(right));
}

async function createSession(env: RuntimeEnv, accountId: string) {
  const token = randomToken();
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000).toISOString();
  await env.DB.prepare("INSERT INTO sessions (id, account_id, token_hash, expires_at) VALUES (?, ?, ?, ?)")
    .bind(id, accountId, await sha256(token), expiresAt).run();
  setCookie(SESSION_COOKIE, token, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: SESSION_DAYS * 86400 });
}

export async function currentActor(): Promise<Actor | null> {
  const token = getCookie(SESSION_COOKIE);
  if (!token) return null;
  const env = await runtimeEnv();
  const row = await env.DB.prepare(`SELECT a.id, a.display_name, a.role FROM sessions s JOIN accounts a ON a.id = s.account_id WHERE s.token_hash = ? AND s.expires_at > CURRENT_TIMESTAMP`)
    .bind(await sha256(token)).first<{ id: string; display_name: string; role: string }>();
  if (!row) return null;
  return { id: row.id, displayName: row.display_name, isOwner: row.role === "owner" };
}

export async function loginOwner(email: string, password: string) {
  const env = await runtimeEnv();
  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail !== "lowan.rtn@icloud.com") throw new Error("Identifiant ou mot de passe incorrect.");
  if (password.length < 10) throw new Error("Le mot de passe doit contenir au moins 10 caractères.");

  let owner = await env.DB.prepare("SELECT id, password_hash, password_salt FROM accounts WHERE email = ?").bind(normalizedEmail)
    .first<{ id: string; password_hash: string | null; password_salt: string | null }>();
  if (!owner) {
    const bootstrap = env.OWNER_BOOTSTRAP_PASSWORD;
    if (!bootstrap || !(await matchesSecret(password, bootstrap))) throw new Error("Identifiant ou mot de passe incorrect.");
    const id = crypto.randomUUID();
    const { hash, salt } = await passwordHash(password);
    const listId = crypto.randomUUID();
    const inviteToken = randomToken();
    await env.DB.batch([
      env.DB.prepare("INSERT INTO accounts (id, email, display_name, role, password_hash, password_salt, owner_setup_completed_at) VALUES (?, ?, ?, 'owner', ?, ?, CURRENT_TIMESTAMP)").bind(id, normalizedEmail, "Lowan", hash, salt),
      env.DB.prepare("INSERT INTO app_list (id, name, invite_token, invite_token_hash, created_by) VALUES (?, ?, ?, ?, ?)").bind(listId, "Liste de l'appart", inviteToken, await sha256(inviteToken), id),
      env.DB.prepare("INSERT INTO tags (id, list_id, key, name, color, rank) VALUES (?, ?, 'buy', 'À acheter', 'teal', 1)").bind(crypto.randomUUID(), listId),
      env.DB.prepare("INSERT INTO tags (id, list_id, key, name, color, rank) VALUES (?, ?, 'reserved', 'Réservé', 'amber', 2)").bind(crypto.randomUUID(), listId),
      env.DB.prepare("INSERT INTO tags (id, list_id, key, name, color, rank) VALUES (?, ?, 'done', 'Acheté', 'green', 3)").bind(crypto.randomUUID(), listId),
    ]);
    owner = { id, password_hash: hash, password_salt: salt };
  } else if (!owner.password_hash || !owner.password_salt || !(await matchesPassword(password, owner.password_salt, owner.password_hash))) {
    throw new Error("Identifiant ou mot de passe incorrect.");
  }
  await createSession(env, owner.id);
}

export async function createGuest(displayName: string, inviteToken: string) {
  const env = await runtimeEnv();
  const name = displayName.trim().slice(0, 60);
  if (name.length < 2) throw new Error("Choisissez un nom d'au moins 2 caractères.");
  const list = await env.DB.prepare("SELECT id FROM app_list WHERE invite_token_hash = ?").bind(await sha256(inviteToken)).first<{ id: string }>();
  if (!list) throw new Error("Ce lien d'invitation est invalide.");
  const id = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO accounts (id, display_name, role) VALUES (?, ?, 'guest')").bind(id, name).run();
  await createSession(env, id);
}
