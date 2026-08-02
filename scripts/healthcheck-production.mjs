import { performance } from "node:perf_hooks";
import process from "node:process";
import { clearTimeout, setTimeout } from "node:timers";

const defaultTargets = [
  { name: "clinica", url: "https://podo360.supremetechdev.com/" },
  { name: "admin", url: "https://podoadmin360.supremetechdev.com/" },
  {
    name: "servico-auth",
    url: "https://xnntitaajweajashzgtk.supabase.co/auth/v1/health",
    acceptedStatuses: [200, 401]
  }
];

if (process.env.HEALTHCHECK_INCLUDE_CADASTRO === "true") {
  defaultTargets.splice(2, 0, {
    name: "cadastro",
    url: "https://cadastro.podo360.supremetechdev.com/"
  });
}

const timeoutMs = Number(process.env.HEALTHCHECK_TIMEOUT_MS ?? 10_000);
const attempts = Number(process.env.HEALTHCHECK_ATTEMPTS ?? 3);
const maxResponseMs = Number(process.env.HEALTHCHECK_MAX_RESPONSE_MS ?? 5_000);

async function probe({ name, url, acceptedStatuses = [200] }) {
  const samples = [];
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new globalThis.AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const startedAt = performance.now();
    try {
      const response = await globalThis.fetch(url, {
        method: "GET",
        redirect: "follow",
        cache: "no-store",
        signal: controller.signal
      });
      const elapsedMs = Math.round(performance.now() - startedAt);
      const accepted = acceptedStatuses.includes(response.status) && elapsedMs <= maxResponseMs;
      samples.push({
        attempt,
        ok: accepted,
        status: response.status,
        elapsedMs
      });
    } catch (error) {
      samples.push({
        attempt,
        ok: false,
        status: 0,
        elapsedMs: Math.round(performance.now() - startedAt),
        error: error instanceof Error ? error.name : "request_failed"
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  const successes = samples.filter((sample) => sample.ok);
  return {
    name,
    url,
    ok: successes.length === attempts,
    successes: successes.length,
    attempts,
    minMs: successes.length ? Math.min(...successes.map((sample) => sample.elapsedMs)) : null,
    maxMs: successes.length ? Math.max(...successes.map((sample) => sample.elapsedMs)) : null,
    samples
  };
}

const results = [];
for (const target of defaultTargets) {
  results.push(await probe(target));
}

for (const result of results) {
  const timing = result.minMs === null ? "sem resposta" : `${result.minMs}-${result.maxMs} ms`;
  globalThis.console.log(`${result.ok ? "OK" : "FALHA"} ${result.name}: ${result.successes}/${result.attempts} (${timing})`);
}

if (results.some((result) => !result.ok)) {
  process.exitCode = 1;
}
