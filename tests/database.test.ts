import { beforeAll, afterAll, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import type { Match } from "../src/lib/domain";
let db: PGlite;
const uid = "11111111-1111-4111-8111-111111111111",
  mid = "22222222-2222-4222-8222-222222222222";
const m: Match = {
  id: mid,
  slug: "prueba-db",
  opponent: "Solo prueba",
  competition: "Prueba",
  kickoff: "2099-01-01T02:00:00Z",
  stadium: "Estadio Akron",
  published: true,
  allowIndividual: true,
  prices: {
    A5: 500000,
    B5: 400000,
    B3: 250000,
    B2: 180000,
    individualA: 110000,
    individualB: 90000,
  },
  version: 1,
};
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated,service_role;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`,
  );
  const migration = (
    await readFile("supabase/migrations/202611010001_initial.sql", "utf8")
  ).replace("create extension if not exists pgcrypto;", "");
  await db.exec(migration);
  await db.query("insert into auth.users values($1)", [uid]);
  await db.query(
    "insert into admin_accounts values($1,'owner@test.local','owner',true)",
    [uid],
  );
  await db.query(
    "insert into matches(id,slug,published,data) values($1,$2,true,$3)",
    [mid, m.slug, m],
  );
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid]);
});
afterAll(async () => {
  await db.close();
});
it("la migración crea diez lugares por partido y reserva con exclusión de paquetes superpuestos", async () => {
  const inv = await db.query("select * from seat_inventory");
  expect(inv.rows).toHaveLength(10);
  await db.exec("set role authenticated");
  const first = await db.query<{ result: { id: string } }>(
    "select inventory_transition('reserve',$1,$2,'B3',null,0,'{}') as result",
    [mid, ["B-R10", "B-R11", "B-R12"]],
  );
  expect(first.rows[0].result.id).toBeTruthy();
  await expect(
    db.query("select inventory_transition('reserve',$1,$2,'B5',null,0,'{}')", [
      mid,
      ["B-R10", "B-R11", "B-R12", "B-Q13", "B-Q14"],
    ]),
  ).rejects.toThrow(/disponibles/);
  const result = await db.query<{ n: number }>(
    "select count(*)::int n from seat_inventory where status='reserved'",
  );
  expect(result.rows[0].n).toBe(3);
  await db.exec("reset role");
});
it("RLS oculta datos privados y partidos sin publicar al visitante", async () => {
  const hidden = {
    ...m,
    id: "33333333-3333-4333-8333-333333333333",
    slug: "oculto",
    published: false,
  };
  await db.query(
    "insert into matches(id,slug,published,data) values($1,$2,false,$3)",
    [hidden.id, hidden.slug, hidden],
  );
  await db.query("select set_config('request.jwt.claim.sub','',false)");
  await db.exec("set role anon");
  expect((await db.query("select * from matches")).rows).toHaveLength(1);
  await expect(db.query("select * from reservations")).rejects.toThrow(
    /permission/,
  );
  await expect(
    db.query("select inventory_transition('reserve',$1,$2,'B2',null,0,'{}')", [
      mid,
      ["B-Q13", "B-Q14"],
    ]),
  ).rejects.toThrow(/permission/);
  await db.exec("reset role");
});
it("los webhooks son idempotentes y nunca reservan inventario por una consulta", async () => {
  await db.exec("set role service_role");
  const id = "44444444-4444-4444-8444-444444444444";
  const i = await db.query<{ i: { code: string } }>(
    "select create_inquiry($1,$2,$3,'A5','test-ip') i",
    [id, mid, ["A-S15", "A-S16", "A-S17", "A-S18", "A-S19"]],
  );
  const code = i.rows[0].i.code;
  for (let n = 0; n < 2; n++)
    await db.query("select process_whatsapp_message($1,$2,$3,now())", [
      "test-message-id",
      code,
      "523300000000",
    ]);
  expect((await db.query("select * from whatsapp_events")).rows).toHaveLength(
    1,
  );
  expect((await db.query("select * from whatsapp_outbox")).rows).toHaveLength(
    1,
  );
  expect(
    (
      await db.query(
        "select * from seat_inventory where seat_id='A-S15' and status='available'",
      )
    ).rows,
  ).toHaveLength(2);
  await db.exec("reset role");
});
