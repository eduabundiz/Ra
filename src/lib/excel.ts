import { readSheet } from "read-excel-file/node";
import writeExcelFile from "write-excel-file/node";
import { unzipSync, strFromU8 } from "fflate";
import { matchSchema, type Match, type Prices } from "./domain";
export const HEADERS = [
  "clave",
  "rival",
  "competencia",
  "fecha",
  "hora",
  "grupo_a_5",
  "grupo_b_5",
  "grupo_b_3",
  "grupo_b_2",
  "individual_a",
  "individual_b",
  "permitir_individuales",
];
export async function excelTemplate() {
  const instructions = [
    "Carga únicamente información confirmada. La plantilla no incluye partidos ni precios inventados.",
    "Una fila por partido; máximo 100. Los partidos se crean como borradores para revisarlos antes de publicar.",
    "clave: texto único sin espacios, con letras minúsculas, números y guiones. Ejemplo de formato: partido-clave.",
    "fecha: texto AAAA-MM-DD. hora: texto HH:mm de 24 horas. Zona: America/Mexico_City (Guadalajara).",
    "Precios: pesos mexicanos por paquete completo, sin cargos adicionales. No uses signo $ ni separador de miles.",
    "grupo_a_5: cinco en Poniente. grupo_b_5: cinco en Oriente. grupo_b_3: fila R. grupo_b_2: fila Q.",
    "permitir_individuales: SI o NO. Si es SI, ambos precios individuales son obligatorios.",
    "Deja vacíos los paquetes que no quieras ofrecer. No se aceptan fórmulas. La importación no modifica partidos existentes.",
  ];
  return writeExcelFile([
    {
      sheet: "Partidos",
      data: [
        HEADERS.map((value) => ({
          value,
          fontWeight: "bold" as const,
          textColor: "#FFFFFF",
          backgroundColor: "#B5142C",
        })),
      ],
      columns: HEADERS.map(() => ({ width: 23 })),
    },
    {
      sheet: "Instrucciones",
      data: instructions.map((t) => [t]),
      columns: [{ width: 120 }],
    },
  ]).toBuffer();
}
function verifyZip(buffer: Buffer) {
  let total = 0,
    count = 0;
  for (let i = 0; i < buffer.length - 46; i++) {
    if (buffer.readUInt32LE(i) === 0x02014b50) {
      total += buffer.readUInt32LE(i + 24);
      count++;
      if (total > 20 * 1024 * 1024 || count > 200)
        throw new Error("El Excel excede el tamaño descomprimido permitido.");
    }
  }
  if (!count) throw new Error("El archivo no es un Excel .xlsx válido.");
}
export async function parseExcel(
  buffer: Buffer,
): Promise<{ matches: Match[]; errors: string[] }> {
  verifyZip(buffer);
  const files = unzipSync(buffer, {
    filter: (entry) =>
      entry.name.startsWith("xl/worksheets/") && entry.name.endsWith(".xml"),
  });
  if (
    Object.values(files).some((bytes) =>
      /<(?:\w+:)?f(?:\s|>)/.test(strFromU8(bytes)),
    )
  )
    return {
      matches: [],
      errors: ["No se aceptan fórmulas. Usa valores confirmados."],
    };
  let rows;
  try {
    rows = await readSheet(buffer, "Partidos");
  } catch {
    throw new Error(
      "Falta la hoja Partidos o el archivo no es válido. Descarga la plantilla.",
    );
  }
  if (rows.length > 101)
    throw new Error("Importa como máximo 100 partidos por archivo.");
  if (HEADERS.some((h, i) => String(rows[0]?.[i] ?? "").trim() !== h))
    throw new Error("Las columnas no coinciden con la plantilla.");
  const matches: Match[] = [],
    errors: string[] = [];
  const seen = new Set<string>();
  rows.forEach((row, index) => {
    const n = index + 1;
    if (index === 0 || row.every((c) => c === null || c === "")) return;
    try {
      const cells = HEADERS.map((_, i) => {
        const v = row[i];
        if (v instanceof Date)
          return i === 4
            ? v.toISOString().slice(11, 16)
            : v.toISOString().slice(0, 10);
        if (i === 4 && typeof v === "number" && v >= 0 && v < 1) {
          const mins = Math.round(v * 1440);
          return (
            String(Math.floor(mins / 60)).padStart(2, "0") +
            ":" +
            String(mins % 60).padStart(2, "0")
          );
        }
        return String(v ?? "").trim();
      });
      const [slug, opponent, competition, date, time, ...rest] = cells;
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
      )
        throw new Error("Fecha AAAA-MM-DD y hora HH:mm obligatorias.");
      const d = new Date(`${date}T${time}:00-06:00`);
      if (
        !Number.isFinite(d.getTime()) ||
        new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/Mexico_City",
        }).format(d) !== date
      )
        throw new Error("La fecha no existe.");
      if (seen.has(slug))
        throw new Error("La clave está duplicada dentro del archivo.");
      const amounts = rest.slice(0, 6).map((v) => {
        if (!v) return null;
        if (!/^\d+(\.\d{1,2})?$/.test(v))
          throw new Error(
            "Precios en pesos, solo números y hasta dos decimales.",
          );
        return Math.round(Number(v) * 100);
      });
      const flag = rest[6].toUpperCase();
      if (!["SI", "SÍ", "NO"].includes(flag))
        throw new Error("permitir_individuales debe ser SI o NO.");
      const [A5, B5, B3, B2, individualA, individualB] = amounts;
      const prices: Prices = { A5, B5, B3, B2, individualA, individualB };
      const m = matchSchema.parse({
        id: crypto.randomUUID(),
        slug,
        opponent,
        competition,
        kickoff: d.toISOString(),
        stadium: "Estadio Akron",
        published: false,
        allowIndividual: flag !== "NO",
        prices,
        version: 0,
      });
      matches.push(m);
      seen.add(slug);
    } catch (e) {
      errors.push(
        `Fila ${n}: ${e instanceof Error ? e.message : "Datos inválidos"}`,
      );
    }
  });
  if (!matches.length && !errors.length)
    errors.push("El archivo no contiene partidos.");
  return { matches, errors };
}
