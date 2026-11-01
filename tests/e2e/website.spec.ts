import { test as base, expect, type Page } from "@playwright/test";
import chromium from "@sparticuz/chromium";
const test =
  process.env.USE_BUNDLED_CHROMIUM === "1"
    ? base.extend({
        context: async ({ playwright, baseURL, viewport }, run) => {
          const browser = await playwright.chromium.launch({
            executablePath: await chromium.executablePath(),
            args: chromium.args.filter(
              (a) =>
                !a.startsWith("--disable-web-security") &&
                !a.startsWith("--allow-running-insecure-content"),
            ),
          });
          const context = await browser.newContext({ baseURL, viewport });
          try {
            await run(context);
          } finally {
            await browser.close();
          }
        },
      })
    : base;
import AxeBuilder from "@axe-core/playwright";
import { createHmac } from "node:crypto";
import readExcelFile from "read-excel-file/node";
import writeExcelFile, {
  type SheetData as WritableSheetData,
} from "write-excel-file/node";
import { mkdir } from "node:fs/promises";
async function login(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Correo electrónico").fill("demo@relampamigos.local");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("e2e-password-local-only");
  await page.getByRole("button", { name: "Entrar al panel" }).click();
  await expect(
    page.getByRole("heading", { name: "Partidos", exact: true }),
  ).toBeVisible();
}
test("sitio responsive, navegación, contenido y accesibilidad", async ({
  page,
}) => {
  await mkdir("output/screenshots", { recursive: true });
  const startup = await Promise.all(
    ["/", "/api/catalog", "/partidos/partido-demo-1"].map((path) =>
      page.request.get(path),
    ),
  );
  expect(startup.map((r) => r.status())).toEqual([200, 200, 200]);
  for (const [label, width, height] of [
    ["desktop", 1440, 1000],
    ["tablet", 820, 1180],
    ["mobile", 390, 844],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await page.locator(".hero-photo").waitFor();
    await page.evaluate(() => document.fonts.ready);
    await expect(
      page.getByRole("heading", { name: /el partido se vive juntos/i }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `output/screenshots/inicio-${label}.png`,
      fullPage: true,
    });
    if (label === "mobile") {
      await page.getByRole("button", { name: "Abrir menú" }).click();
      await page
        .getByRole("link", { name: "Partidos", exact: true })
        .first()
        .click();
      await expect(page).toHaveURL(/\/partidos$/);
    }
    if (label === "desktop")
      await page.screenshot({
        path: "output/screenshots/portada-presentacion.png",
      });
    for (const [route, name] of [
      ["/partidos", "catalogo"],
      ["/partidos/partido-demo-1", "detalle"],
    ]) {
      await page.goto(route);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `output/screenshots/${name}-${label}.png`,
        fullPage: true,
      });
      if (label === "desktop") {
        const audit = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        expect(audit.violations).toEqual([]);
      }
    }
  }
  await page.goto("/");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});
test("selección de grupo e individual y enlace contextual de WhatsApp sin apartar automáticamente", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/partidos/partido-demo-1");
  await page.getByRole("button", { name: /Poniente · 5 juntos/ }).click();
  await expect(page.locator(".purchase-summary h3")).toHaveText("5 lugares");
  await page.getByRole("button", { name: "Consultar por WhatsApp" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const link = dialog.getByRole("link", { name: /Abrir WhatsApp/ });
  const url = new URL((await link.getAttribute("href"))!);
  expect(url.pathname).toBe("/523314581203");
  expect(url.searchParams.get("text")).toContain("Cantidad: 5");
  expect(url.searchParams.get("text")).toContain("Poniente");
  expect(url.searchParams.get("text")).toContain("RL-");
  const catalog = await (await request.get("/api/catalog")).json();
  expect(
    catalog.inventory.every(
      (i: { status: string }) => i.status === "available",
    ),
  ).toBe(true);
  await dialog.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page.getByRole("button", { name: "Asientos individuales" }).click();
  await page
    .getByRole("button", { name: /fila S, asiento 15, disponible/ })
    .click();
  await page
    .getByRole("button", { name: /fila R, asiento 10, disponible/ })
    .click();
  await expect(page.locator(".purchase-summary h3")).toHaveText("2 lugares");
  await page.getByRole("button", { name: "Consultar por WhatsApp" }).click();
  await expect(page.locator(".message-preview")).toContainText(
    "Selección individual",
  );
  await page.screenshot({
    path: "output/screenshots/seleccion-mobile.png",
    fullPage: true,
  });
});
test("autenticación, webhook firmado e idempotente, reservas concurrentes, entrega y venta", async ({
  page,
  request,
}) => {
  expect((await request.get("/api/admin/state")).status()).toBe(401);
  await login(page);
  const s = await (await page.request.get("/api/admin/state")).json();
  const inquiry = s.inquiries.find(
    (i: { seatIds: string[] }) => i.seatIds.length === 5,
  );
  const payload = JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: "e2e-phone-id" },
              messages: [
                {
                  id: "wamid-test-1",
                  from: "523300000000",
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  text: { body: inquiry.code },
                },
              ],
            },
          },
        ],
      },
    ],
  });
  const signature =
    "sha256=" +
    createHmac("sha256", "e2e-whatsapp-secret").update(payload).digest("hex");
  expect(
    (
      await request.post("/api/whatsapp/webhook", {
        data: payload,
        headers: {
          "Content-Type": "application/json",
          "x-hub-signature-256": "bad",
        },
      })
    ).status(),
  ).toBe(403);
  for (let i = 0; i < 2; i++)
    expect(
      (
        await request.post("/api/whatsapp/webhook", {
          data: payload,
          headers: {
            "Content-Type": "application/json",
            "x-hub-signature-256": signature,
          },
        })
      ).ok(),
    ).toBe(true);
  await page.getByRole("button", { name: "Consultas", exact: true }).click();
  await page.getByRole("button", { name: "Actualizar", exact: true }).click();
  await expect(page.getByText("523300000000", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Apartar", exact: true }).click();
  await page.getByLabel("Nombre del cliente").fill("Cliente de prueba");
  await page.getByRole("button", { name: "Confirmar apartado" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const body = {
    action: "reserve",
    matchId: inquiry.matchId,
    seatIds: ["B-R10", "B-R11", "B-R12"],
    packageId: "B3",
    customerName: "Prueba simultánea",
    customerPhone: "",
  };
  const responses = await Promise.all([
    page.request.post("/api/admin/transition", {
      data: body,
      headers: { Origin: "http://127.0.0.1:3100" },
    }),
    page.request.post("/api/admin/transition", {
      data: body,
      headers: { Origin: "http://127.0.0.1:3100" },
    }),
  ]);
  expect(responses.map((r) => r.status()).sort()).toEqual([200, 400]);
  await page.getByRole("button", { name: "Apartados", exact: true }).click();
  await page.getByRole("button", { name: "Actualizar", exact: true }).click();
  const card = page
    .locator(".reservation-card")
    .filter({ hasText: "Cliente de prueba" });
  await card.getByRole("button", { name: "Gestionar apartado" }).click();
  await page.getByLabel("Pago recibido y verificado por nosotros").check();
  await page
    .getByLabel("Transferencia por Boletomóvil")
    .selectOption("completed");
  await page
    .getByRole("button", { name: "Guardar pago, entrega y notas" })
    .click();
  await card.getByRole("button", { name: "Gestionar apartado" }).click();
  await page.getByRole("button", { name: "Confirmar venta cerrada" }).click();
  await expect(card.getByText("Vendido", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "output/screenshots/panel-apartados.png",
    fullPage: true,
  });
  const publicData = await (await request.get("/api/catalog")).json();
  expect(JSON.stringify(publicData)).not.toContain("Cliente de prueba");
  expect(
    publicData.inventory.filter(
      (i: { matchId: string; status: string }) =>
        i.matchId === inquiry.matchId && i.status === "sold",
    ),
  ).toHaveLength(5);
  expect(publicData.reservations).toEqual([]);
});
test("Excel, publicación de borrador y control de venta individual", async ({
  page,
}) => {
  await login(page);
  const dl = await page.request.get("/api/admin/template");
  expect(dl.ok()).toBe(true);
  const sheets = await readExcelFile(Buffer.from(await dl.body()));
  const rows = sheets.find((s) => s.sheet === "Partidos")!.data;
  rows.push([
    "importado-prueba",
    "Rival Excel de prueba",
    "Demostración",
    "2099-01-07",
    "20:00",
    5000,
    4000,
    2500,
    1800,
    "",
    "",
    "NO",
  ]);
  await page.getByRole("button", { name: "Cargar Excel" }).click();
  await page.getByLabel("Archivo .xlsx · máximo 2 MB").setInputFiles({
    name: "partidos.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: await writeExcelFile(rows as unknown as WritableSheetData, {
      sheet: "Partidos",
    }).toBuffer(),
  });
  await page.getByRole("button", { name: "Revisar archivo" }).click();
  await expect(
    page.getByRole("heading", { name: "1 partidos encontrados" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Importar 1 borradores" }).click();
  const card = page
    .locator(".admin-match")
    .filter({ hasText: "Rival Excel de prueba" });
  await expect(card).toContainText("BORRADOR");
  await card.getByRole("button", { name: "Editar", exact: true }).click();
  await page.getByLabel("Publicar en la página").check();
  await page.getByRole("button", { name: "Guardar partido" }).click();
  await expect(card).toContainText("PUBLICADO");
  await page.goto("/partidos/importado-prueba");
  await expect(
    page.getByRole("button", { name: "Asientos individuales" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Poniente · 5 juntos/ }),
  ).toBeEnabled();
});
test("carga de fotografía privada, revisión y publicación", async ({
  page,
  request,
}) => {
  await login(page);
  await page.getByRole("button", { name: "Fotografías", exact: true }).click();
  const disguised = await page.request.post("/api/admin/upload", {
    headers: { Origin: "http://127.0.0.1:3100" },
    multipart: {
      title: "Contenido no permitido",
      group: "all",
      kind: "photo",
      file: {
        name: "fake.jpg",
        mimeType: "image/jpeg",
        buffer: Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>',
        ),
      },
    },
  });
  expect(disguised.status()).toBe(400);
  await page
    .getByLabel("Descripción pública")
    .fill("Fotografía de prueba del estadio");
  await page
    .getByLabel("JPG, PNG o WebP · hasta 8 MB")
    .setInputFiles("public/images/akron-real.jpg");
  await page.getByRole("button", { name: "Subir para revisar" }).click();
  const card = page
    .locator(".admin-media-grid article")
    .filter({ hasText: "Fotografía de prueba del estadio" });
  await expect(card).toBeVisible();
  const img = await card.locator("img").getAttribute("src");
  expect((await request.get(img!)).status()).toBe(404);
  await card.getByRole("checkbox").check();
  await card.getByRole("button", { name: "Publicar fotografía" }).click();
  await expect(card).toContainText("PUBLICADA");
  expect((await request.get(img!)).ok()).toBe(true);
});

test("panel en móvil y protección contra origen externo", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "output/screenshots/panel-mobile.png",
    fullPage: true,
  });
  const attack = await page.request.post("/api/admin/settings", {
    data: {},
    headers: { Origin: "https://sitio-ajeno.example" },
  });
  expect(attack.status()).toBe(400);
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
});
