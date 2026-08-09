import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = path.resolve(process.argv[2] ?? "dist");
const forbidden = [
  { label: "local application endpoint", pattern: /https?:\/\/localhost:(?:3000|5173|54321)(?=\/|$)/i },
  { label: "loopback application endpoint", pattern: /https?:\/\/127\.0\.0\.1:(?:80|3000|5173|54321)(?=\/|$)/i },
  { label: "private LAN IPv4", pattern: /192\.168\.\d{1,3}\.\d{1,3}/ },
  { label: "retired Tailscale address", pattern: /100\.84\.\d{1,3}\.\d{1,3}/ }
];
const textExtensions = new Set([".css", ".html", ".js", ".json", ".map", ".txt"]);
const findings = [];

async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await scan(filePath);
      continue;
    }
    if (!textExtensions.has(path.extname(entry.name))) continue;
    const content = await readFile(filePath, "utf8");
    for (const rule of forbidden) {
      if (rule.pattern.test(content)) findings.push(`${path.relative(root, filePath)}: ${rule.label}`);
    }
  }
}

await scan(root);

if (findings.length) {
  globalThis.console.error("O build contem dependencias locais proibidas:");
  for (const finding of findings) globalThis.console.error(`- ${finding}`);
  process.exit(1);
}

globalThis.console.log("Build sem URLs ou IPs do servidor local.");
