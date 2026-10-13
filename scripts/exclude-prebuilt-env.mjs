import { readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Vercel's Next.js builder adds root env files independently of Next.js tracing.
// Remove those upload references; runtime variables are supplied by deploy-orbs.
export function excludePrebuiltEnvFiles(functionsDir) {
  let excluded = 0;
  for (const entry of readdirSync(functionsDir, { withFileTypes: true })) {
    const path = join(functionsDir, entry.name);
    if (entry.isDirectory()) {
      excluded += excludePrebuiltEnvFiles(path);
    } else if (entry.isFile() && entry.name === ".vc-config.json") {
      const config = JSON.parse(readFileSync(path, "utf8"));
      const envFiles = Object.keys(config.filePathMap ?? {}).filter(file =>
        /^\.env[^/\\]*$/.test(file),
      );
      if (!envFiles.length) continue;
      for (const file of envFiles) {
        delete config.filePathMap[file];
        // Older builders may also copy the file into the function directory.
        rmSync(join(functionsDir, file), { force: true });
      }
      writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`);
      excluded += envFiles.length;
    }
    // Function aliases are symlinks; their shared target is handled once above.
  }
  return excluded;
}
