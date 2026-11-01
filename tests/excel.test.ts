import { it, expect } from "vitest";
import writeExcelFile, { type SheetData } from "write-excel-file/node";
import readExcelFile from "read-excel-file/node";
import { HEADERS, parseExcel, excelTemplate } from "../src/lib/excel";
async function file(values: unknown[]) {
  return writeExcelFile([HEADERS, values] as SheetData, {
    sheet: "Partidos",
  }).toBuffer();
}
const row = [
  "partido-prueba",
  "Rival de muestra",
  "Prueba",
  "2099-01-07",
  "20:00",
  5000,
  4000,
  2500,
  1800,
  1100,
  900,
  "SI",
];
it("la plantilla no inventa partidos y explica los campos", async () => {
  const sheets = await readExcelFile(await excelTemplate());
  expect(sheets.find((s) => s.sheet === "Partidos")?.data).toHaveLength(1);
  expect(
    sheets.find((s) => s.sheet === "Instrucciones")!.data.length,
  ).toBeGreaterThan(5);
});
it("importa fechas de Guadalajara y precios exactos en centavos, siempre en borrador", async () => {
  const r = await parseExcel(await file(row));
  expect(r.errors).toEqual([]);
  expect(r.matches[0].kickoff).toBe("2099-01-08T02:00:00.000Z");
  expect(r.matches[0].prices.A5).toBe(500000);
  expect(r.matches[0].published).toBe(false);
});
it("rechaza fechas inexistentes y fórmulas", async () => {
  const r: unknown[] = [...row];
  r[3] = "2099-02-30";
  expect((await parseExcel(await file(r))).errors).toHaveLength(1);
  r[3] = "2099-01-07";
  r[5] = { type: "Formula", value: "=1+1" };
  expect((await parseExcel(await file(r))).errors[0]).toContain("fórmulas");
});
it("rechaza un archivo que no es un Excel", async () =>
  expect(parseExcel(Buffer.from("archivo falso"))).rejects.toThrow(/xlsx/));
