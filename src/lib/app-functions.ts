import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const input = <T extends z.ZodType>(schema: T) => (value: unknown) => schema.parse(value);
const id = z.string().uuid();

async function server() {
  return import("./app.server");
}

export const login = createServerFn({ method: "POST" })
  .validator(input(z.object({ email: z.string().email(), password: z.string().min(10) })))
  .handler(async ({ data }) => (await server()).loginOwner(data.email, data.password));

export const enterAsGuest = createServerFn({ method: "POST" })
  .validator(input(z.object({ name: z.string().min(2).max(60), inviteToken: z.string().min(20) })))
  .handler(async ({ data }) => (await server()).createGuest(data.name, data.inviteToken));

export const session = createServerFn({ method: "GET" }).handler(async () => (await server()).currentActor());

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  const { currentActor, runtimeEnv } = await server();
  const actor = await currentActor();
  if (actor) {
    const env = await runtimeEnv();
    await env.DB.prepare("DELETE FROM sessions WHERE account_id = ?").bind(actor.id).run();
  }
  const { deleteCookie } = await import("@tanstack/react-start/server");
  deleteCookie("lt_session", { path: "/" });
});

export const listData = createServerFn({ method: "GET" }).handler(async () => {
  const { currentActor, runtimeEnv } = await server();
  const actor = await currentActor();
  if (!actor) throw new Error("Connexion requise.");
  const env = await runtimeEnv();
  const list = await env.DB.prepare("SELECT id, name, invite_token, created_by FROM app_list LIMIT 1").first<{ id: string; name: string; invite_token: string; created_by: string }>();
  if (!list) throw new Error("La liste sera créée lors de la première connexion owner.");
  const [tags, itemRows, events, members] = await env.DB.batch([
    env.DB.prepare("SELECT id, key, name, color, rank FROM tags WHERE list_id = ? ORDER BY rank, created_at").bind(list.id),
    env.DB.prepare(`SELECT i.id, i.name, i.quantity, i.status, i.updated_at, i.created_by, i.reserved_by, i.purchased_by,
      (SELECT tag_id FROM item_tags WHERE item_id = i.id LIMIT 1) tag_id FROM items i WHERE i.list_id = ? AND i.status != 'archived'`).bind(list.id),
    env.DB.prepare(`SELECT e.id, e.event_type type, e.created_at, a.id user_id, a.display_name user_name, i.name item_name, e.details
      FROM activity_log e LEFT JOIN accounts a ON a.id = e.account_id LEFT JOIN items i ON i.id = e.item_id
      WHERE e.list_id = ? ORDER BY e.created_at DESC LIMIT 300`).bind(list.id),
    env.DB.prepare("SELECT id, display_name FROM accounts ORDER BY created_at").bind(),
  ]);
  return {
    list: { ...list, invite_code: list.invite_token },
    isOwner: actor.isOwner,
    tags: tags.results ?? [],
    items: (itemRows.results ?? []).map((row: any) => ({ ...row, qty: row.quantity, tag_id: row.tag_id })),
    events: events.results ?? [], members: members.results ?? [], me: actor.id,
  };
});

async function ownItem(itemId: string) {
  const { currentActor, runtimeEnv } = await server();
  const actor = await currentActor();
  if (!actor) throw new Error("Connexion requise.");
  const env = await runtimeEnv();
  const item = await env.DB.prepare("SELECT i.*, l.id list_id FROM items i JOIN app_list l ON l.id = i.list_id WHERE i.id = ?").bind(itemId).first<any>();
  if (!item) throw new Error("Article introuvable.");
  return { actor, env, item };
}

export const addItem = createServerFn({ method: "POST" })
  .validator(input(z.object({ name: z.string().min(1).max(160), qty: z.string().max(40).optional() })))
  .handler(async ({ data }) => {
    const { currentActor, runtimeEnv } = await server(); const actor = await currentActor(); if (!actor) throw new Error("Connexion requise."); const env = await runtimeEnv();
    const list = await env.DB.prepare("SELECT id FROM app_list LIMIT 1").first<{ id: string }>(); if (!list) throw new Error("La liste n'est pas prête.");
    const buy = await env.DB.prepare("SELECT id FROM tags WHERE list_id = ? AND key = 'buy'").bind(list.id).first<{ id: string }>(); if (!buy) throw new Error("Étiquette manquante.");
    const itemId = crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare("INSERT INTO items (id, list_id, created_by, name, quantity) VALUES (?, ?, ?, ?, ?)").bind(itemId, list.id, actor.id, data.name.trim(), data.qty?.trim() || null),
      env.DB.prepare("INSERT INTO item_tags (item_id, tag_id) VALUES (?, ?)").bind(itemId, buy.id),
      env.DB.prepare("INSERT INTO activity_log (id, list_id, item_id, account_id, event_type) VALUES (?, ?, ?, ?, 'add')").bind(crypto.randomUUID(), list.id, itemId, actor.id),
    ]);
  });

export const setItemTag = createServerFn({ method: "POST" })
  .validator(input(z.object({ itemId: id, tagId: id })))
  .handler(async ({ data }) => {
    const { actor, env, item } = await ownItem(data.itemId);
    const tag = await env.DB.prepare("SELECT key FROM tags WHERE id = ? AND list_id = ?").bind(data.tagId, item.list_id).first<{ key: string | null }>();
    if (!tag) throw new Error("Étiquette introuvable.");
    const status = tag.key === "done" ? "bought" : tag.key === "reserved" ? "reserved" : "to_buy";
    if (status !== "bought" && !actor.isOwner && item.created_by !== actor.id) throw new Error("Vous ne pouvez modifier que vos propres articles.");
    await env.DB.batch([
      env.DB.prepare("UPDATE items SET status = ?, reserved_by = ?, purchased_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(status, status === "reserved" ? actor.id : null, status === "bought" ? actor.id : null, item.id),
      env.DB.prepare("DELETE FROM item_tags WHERE item_id = ?").bind(item.id),
      env.DB.prepare("INSERT INTO item_tags (item_id, tag_id) VALUES (?, ?)").bind(item.id, data.tagId),
      env.DB.prepare("INSERT INTO activity_log (id, list_id, item_id, account_id, event_type, details) VALUES (?, ?, ?, ?, 'tag', ?)").bind(crypto.randomUUID(), item.list_id, item.id, actor.id, status),
    ]);
  });

export const setItemQuantity = createServerFn({ method: "POST" })
  .validator(input(z.object({ itemId: id, qty: z.string().max(40) })))
  .handler(async ({ data }) => { const { actor, env, item } = await ownItem(data.itemId); if (!actor.isOwner && item.created_by !== actor.id) throw new Error("Vous ne pouvez modifier que vos propres articles."); await env.DB.prepare("UPDATE items SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(data.qty.trim() || null, item.id).run(); });

export const archiveItem = createServerFn({ method: "POST" })
  .validator(input(z.object({ itemId: id })))
  .handler(async ({ data }) => { const { actor, env, item } = await ownItem(data.itemId); if (!actor.isOwner && item.created_by !== actor.id) throw new Error("Vous ne pouvez archiver que vos propres articles."); await env.DB.batch([env.DB.prepare("UPDATE items SET status = 'archived', archived_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(item.id), env.DB.prepare("INSERT INTO activity_log (id, list_id, item_id, account_id, event_type) VALUES (?, ?, ?, ?, 'archive')").bind(crypto.randomUUID(), item.list_id, item.id, actor.id)]); });
