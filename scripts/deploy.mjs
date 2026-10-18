import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { excludePrebuiltEnvFiles } from "./exclude-prebuilt-env.mjs";

const projectId = "prj_sIICLUBkrigIaJiTQMEPxfgqoRf4";
const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const options = new Set(process.argv.slice(2));
const usage = `Usage: yarn deploy [--prod] [--build-only] [--dry-run]

Build Orbs locally for production, then deploy .vercel/output to the fixed Orbs project.
  --prod        Accepted for compatibility; production is always the target.
  --build-only  Pull settings and build locally, without deploying.
  --dry-run     Show the steps without contacting Vercel or building.
  --help        Show this help.

Requires installed project dependencies and Vercel CLI (verified with 58.9.0).
Authenticate with vercel login or VERCEL_TOKEN; CI also needs VERCEL_ORG_ID.
Local production-mode Next.js .env files and shell variables take precedence
over pulled Vercel variables. RPC_URL and NEXT_PUBLIC_PROJECT_ID are required.
`;

for (const option of options) {
  if (!["--prod", "--build-only", "--dry-run", "--help", "-h"].includes(option)) {
    console.error(`Unknown option: ${option}\n${usage}`);
    process.exit(2);
  }
}
if (options.has("--help") || options.has("-h")) {
  console.log(usage);
  process.exit(0);
}

const target = "production";
const dryRun = options.has("--dry-run");
process.env.NODE_ENV = "production";
const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env");
loadEnvConfig(repoRoot, false);
// Deployment authentication uses the CLI login or VERCEL_TOKEN.
delete process.env.VERCEL_OIDC_TOKEN;
const deploymentEnv = {
  ...process.env,
  VERCEL_PROJECT_ID: projectId,
  // Avoid packaged CLI telemetry subprocess crashes after an otherwise successful build.
  VERCEL_TELEMETRY_DISABLED: "1",
};

function run(args) {
  const fullArgs = [...args, "--cwd", repoRoot, "--project", projectId, "--yes"];
  if (dryRun) {
    console.log(["vercel", ...fullArgs].map(value => JSON.stringify(value)).join(" "));
    return;
  }
  if (deploymentEnv.VERCEL_TOKEN) fullArgs.push("--token", deploymentEnv.VERCEL_TOKEN);
  const result = spawnSync("vercel", fullArgs, { cwd: repoRoot, env: deploymentEnv, stdio: "inherit" });
  if (result.error) {
    console.error(result.error.code === "ENOENT"
      ? "Install Vercel CLI: npm install --global vercel@58.9.0"
      : "Could not run Vercel CLI.");
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(["pull", "--environment", target]);
if (!dryRun) {
  const linkedProject = JSON.parse(readFileSync(new URL("../.vercel/project.json", import.meta.url), "utf8"));
  if (linkedProject.projectId !== projectId) {
    console.error("Vercel linked a different project. Stopping before building or deploying.");
    process.exit(1);
  }
  // Pull writes only under .vercel; never overwrite the developer's .env files.
  const remoteEnvPath = new URL(`../.vercel/.env.${target}.local`, import.meta.url);
  const pulledEnv = readFileSync(remoteEnvPath, "utf8");
  const appEnv = pulledEnv.replace(/^[\t ]*(?:export[\t ]+)?VERCEL_OIDC_TOKEN[\t ]*=.*(?:\r?\n|$)/gm, "");
  // Vercel adds this unused token on every pull; discard it before the local build.
  if (appEnv !== pulledEnv) writeFileSync(remoteEnvPath, appEnv);
  const remoteEnv = parseEnv(appEnv);
  for (const [key, value] of Object.entries(remoteEnv)) {
    if (deploymentEnv[key] === undefined) deploymentEnv[key] = value;
  }
  const missing = ["RPC_URL", "NEXT_PUBLIC_PROJECT_ID"].filter(key => !deploymentEnv[key]?.trim());
  if (missing.length) {
    console.error(`Missing required environment variables: ${missing.join(", ")}. Set them locally or in the Vercel project.`);
    process.exit(1);
  }
}

run(["build", "--prod"]);
if (!dryRun && !existsSync(new URL("../.vercel/output/config.json", import.meta.url))) {
  console.error("Local build did not produce .vercel/output/config.json. Nothing was deployed.");
  process.exit(1);
}
if (!dryRun) {
  const excluded = excludePrebuiltEnvFiles(fileURLToPath(new URL("../.vercel/output/functions/", import.meta.url)));
  if (excluded) console.log(`Excluded ${excluded} local env file references from prebuilt functions.`);
}
if (options.has("--build-only")) process.exit(0);

// Server env isn't embedded by next build. Forward only app variables, by name,
// so RPC credentials aren't printed or placed in the child process arguments.
const runtimeKeys = Object.keys(deploymentEnv).filter(key =>
  key === "RPC_URL" || key.startsWith("NEXT_PUBLIC_"),
).sort();
run(["deploy", "--prebuilt", "--prod", ...runtimeKeys.flatMap(key => ["--env", key])]);
