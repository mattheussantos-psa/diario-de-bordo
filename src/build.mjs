// Gera ../index.html a partir de template.html, embutindo fonte, logo e avatar como data URI.
// Uso: node src/build.mjs   (a partir da raiz do projeto)
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const b64 = (p) => readFileSync(join(here, "assets", p)).toString("base64");

const html = readFileSync(join(here, "template.html"), "utf8")
  .replace("__FONT__", b64("bruta-pro-extrabold.otf"))
  .replace("__PSA__", b64("logo-psa.png"))
  .replace("__PFP__", b64("rafael-avatar.jpg"));

writeFileSync(join(here, "..", "index.html"), html);
console.log("index.html gerado:", html.length, "bytes");
