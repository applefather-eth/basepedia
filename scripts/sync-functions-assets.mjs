import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

rmSync(resolve(root, "functions/content"), { force: true, recursive: true });
rmSync(resolve(root, "functions/static"), { force: true, recursive: true });
mkdirSync(resolve(root, "functions/public"), { recursive: true });

mkdirSync(resolve(root, "functions/content"), { recursive: true });
cpSync(resolve(root, "src/content/tokens"), resolve(root, "functions/content/tokens"), { recursive: true });
cpSync(resolve(root, "dist/index.html"), resolve(root, "functions/static/index.html"));
cpSync(resolve(root, "public/basepedia-logo.png"), resolve(root, "functions/public/basepedia-logo.png"));
