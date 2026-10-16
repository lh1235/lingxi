import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build, context } from "esbuild";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const pluginsRoot = join(projectRoot, "plugins");

const watchMode = process.argv.includes("--watch");

function listPluginPanels() {
  if (!existsSync(pluginsRoot)) {
    return [];
  }
  return readdirSync(pluginsRoot)
    .map((name) => join(pluginsRoot, name))
    .filter((path) => statSync(path, { throwIfNoEntry: false })?.isDirectory())
    .map((pluginDir) => ({
      pluginDir,
      tsPath: join(pluginDir, "dashboard_panel.ts"),
      jsPath: join(pluginDir, "dashboard_panel.js"),
    }))
    .filter((item) => existsSync(item.tsPath));
}

function buildOptions(panel) {
  return {
    entryPoints: [panel.tsPath],
    outfile: panel.jsPath,
    bundle: false,
    platform: "browser",
    target: "es2020",
    format: "iife",
    logLevel: "info",
  };
}

const panels = listPluginPanels();

if (panels.length === 0) {
  console.log("No plugin dashboard panels found.");
  process.exit(0);
}

if (watchMode) {
  const contexts = await Promise.all(panels.map((panel) => context(buildOptions(panel))));
  await Promise.all(contexts.map((ctx) => ctx.watch()));
  const dispose = async () => {
    await Promise.allSettled(contexts.map((ctx) => ctx.dispose()));
  };
  process.once("SIGINT", async () => {
    await dispose();
    process.exit(130);
  });
  process.once("SIGTERM", async () => {
    await dispose();
    process.exit(143);
  });
} else {
  for (const panel of panels) {
    await build(buildOptions(panel));
  }
}
