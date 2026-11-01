import { spawn } from "node:child_process";
import assert from "node:assert/strict";
const base = "http://127.0.0.1:3200";
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "-p",
    "3200",
    "--hostname",
    "127.0.0.1",
  ],
  {
    env: {
      ...process.env,
      DATA_MODE: "supabase",
      VERCEL_ENV: "production",
      SITE_URL: base,
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let logs = "";
child.stderr.on("data", (b) => (logs += b));
child.stdout.on("data", (b) => (logs += b));
try {
  let ready = false;
  for (let n = 0; n < 150; n++) {
    try {
      ready = (await fetch(base + "/api/health")).ok;
      if (ready) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.ok(ready, logs);
  const catalog = await (await fetch(base + "/api/catalog")).json();
  assert.deepEqual(catalog.matches, []);
  assert.deepEqual(catalog.inventory, []);
  const home = await (await fetch(base)).text();
  assert.ok(home.includes("Pronto habrá partidos."));
  assert.ok(!home.includes("VISTA DE DEMOSTRACIÓN"));
  assert.equal((await fetch(base + "/api/admin/state")).status, 401);
  assert.equal((await fetch(base + "/partidos/partido-demo-1")).status, 404);
  console.log(
    "Producción vacía: sin partidos ni precios de muestra, estado vacío correcto y panel protegido.",
  );
} finally {
  child.kill("SIGTERM");
}
