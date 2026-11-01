import { existsSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
if (existsSync(".env.local")) {
  console.log("Ya existe .env.local. No se sobrescribió.");
  process.exit(0);
}
const password = randomBytes(12).toString("base64url");
writeFileSync(
  ".env.local",
  `DATA_MODE=demo\nSITE_URL=http://localhost:3000\nDEMO_ADMIN_PASSWORD=${password}\nDEMO_SESSION_SECRET=${randomBytes(32).toString("hex")}\nWHATSAPP_MODE=disabled\nWHATSAPP_PHONE=523314581203\n`,
  { mode: 0o600 },
);
console.log(
  `Demostración local lista. Usuario: demo@relampamigos.local\nContraseña: ${password}\nEjecuta npm run dev. Los datos de muestra están marcados y WhatsApp no envía mensajes automáticamente.`,
);
