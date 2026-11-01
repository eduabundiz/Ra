import { readFile, writeFile, mkdir, rename, access } from "node:fs/promises";
import path from "node:path";
import { emptyState, SEATS, type State, type Match } from "./domain";
const dir = path.join(
  process.cwd(),
  ".data",
  process.env.DEMO_DATA_NAMESPACE || "local",
);
let queue: Promise<unknown> = Promise.resolve();
function seed(): State {
  const s = emptyState();
  const base = new Date();
  base.setUTCHours(0, 0, 0, 0);
  s.matches = [0, 1, 2].map(
    (n) =>
      ({
        id: `00000000-0000-4000-8000-00000000000${n + 1}`,
        slug: `partido-demo-${n + 1}`,
        opponent: [
          "Rival de demostración",
          "Invitado de muestra",
          "Rival por anunciar",
        ][n],
        competition: "Encuentro de demostración",
        kickoff: new Date(
          base.getTime() + (n + 1) * 7 * 86400000 + 2 * 3600000,
        ).toISOString(),
        stadium: "Estadio Akron",
        published: n < 2,
        allowIndividual: n === 0,
        prices: {
          A5: 450000,
          B5: 420000,
          B3: 260000,
          B2: 180000,
          individualA: 100000,
          individualB: 95000,
        },
        version: 1,
        demo: true,
      }) satisfies Match,
  );
  s.inventory = s.matches.flatMap((m) =>
    SEATS.map((seat) => ({
      matchId: m.id,
      seatId: seat.id,
      status: "available" as const,
      version: 1,
    })),
  );
  return s;
}
let initialized: Promise<void> | undefined;
export async function readDemo(): Promise<State> {
  if (!initialized)
    initialized = (async () => {
      try {
        await access(path.join(dir, "state.json"));
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
        await mkdir(dir, { recursive: true });
        const temp = path.join(dir, `initial-${crypto.randomUUID()}.tmp`);
        await writeFile(temp, JSON.stringify(seed()), { mode: 0o600 });
        await rename(temp, path.join(dir, "state.json"));
      }
    })();
  await initialized;
  return JSON.parse(await readFile(path.join(dir, "state.json"), "utf8"));
}
export function mutateDemo<T>(
  fn: (state: State) => T | Promise<T>,
): Promise<T> {
  const job = queue.then(async () => {
    const s = await readDemo();
    const result = await fn(s);
    await mkdir(dir, { recursive: true });
    const tmp = path.join(dir, `state-${crypto.randomUUID()}.tmp`);
    await writeFile(tmp, JSON.stringify(s), { mode: 0o600 });
    await rename(tmp, path.join(dir, "state.json"));
    return result;
  });
  queue = job.catch(() => {});
  return job;
}
export const demoDirectory = dir;
