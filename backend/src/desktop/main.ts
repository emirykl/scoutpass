import { app, BrowserWindow, ipcMain } from "electron";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";

import {
  runtimeCommandSchema,
  runtimeEventSchema,
  type RuntimeEvent
} from "../contracts/runtime-messages.js";
import { appRoleSchema, type AppRole } from "../domain/models/common.js";
import { createDesktopRuntime, type DesktopRuntime } from "../runtime/desktop-runtime.js";
import { PearRuntimeHost } from "../runtime/pear-runtime-host.js";

const role = parseRole(process.argv);
const smokeTest = process.argv.includes("--smoke-test");
const explicitStorage = readArgument(process.argv, "--storage");
const storageRoot =
  explicitStorage === undefined
    ? join(app.getPath("userData"), role)
    : resolve(process.cwd(), explicitStorage);

app.setPath("userData", storageRoot);

let runtime: DesktopRuntime | undefined;
let pearHost: PearRuntimeHost | undefined;
let unsubscribeRuntime: (() => void) | undefined;
let shutdownStarted = false;

const sendToRenderers = (event: RuntimeEvent): void => {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send("scoutpass:event", event);
  }
};

const createWindow = async (): Promise<BrowserWindow> => {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 860,
    minHeight: 640,
    title: `ScoutPass ${role === "player" ? "Player" : "Scout"}`,
    backgroundColor: "#f4f5f3",
    show: !smokeTest,
    webPreferences: {
      preload: join(import.meta.dirname, "preload.cjs"),
      sandbox: true,
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (url !== window.webContents.getURL()) event.preventDefault();
  });

  const devServerUrl = process.env.SCOUTPASS_DEV_SERVER_URL;
  if (devServerUrl !== undefined) {
    const url = new URL(devServerUrl);
    url.searchParams.set("role", role);
    await window.loadURL(url.toString());
    return window;
  }
  await window.loadFile(join(app.getAppPath(), "frontend", "dist", "index.html"), {
    query: { role }
  });
  return window;
};

const start = async (): Promise<void> => {
  runtime = createDesktopRuntime({
    dataDir: join(storageRoot, "application"),
    role
  });
  pearHost = new PearRuntimeHost({ dataDir: join(storageRoot, "pear") });
  await pearHost.start();

  unsubscribeRuntime = runtime.onEvent((candidate) => {
    const validated = runtimeEventSchema.parse(candidate);
    void pearHost?.recordEvent(validated).catch(() => undefined);
    sendToRenderers(validated);
  });

  ipcMain.handle("scoutpass:request", async (_event, candidate: unknown) => {
    const command = runtimeCommandSchema.parse(candidate);
    if (runtime === undefined || pearHost === undefined) {
      throw new Error("ScoutPass runtime is not ready.");
    }
    await pearHost.acceptCommand(command);
    const response = runtimeEventSchema.parse(await runtime.handle(command));
    await pearHost.recordEvent(response);
    sendToRenderers(response);
    return response;
  });

  const window = await createWindow();
  if (smokeTest) {
    const candidate: unknown = await window.webContents.executeJavaScript(`
      (() => {
        const runtime = window.scoutpassRuntime;
        if (!runtime || typeof runtime.request !== "function" || typeof runtime.subscribe !== "function") {
          throw new Error("window.scoutpassRuntime was not injected");
        }
        return runtime.request({
          requestId: "request_desktop_smoke_${role}",
          sentAt: new Date().toISOString(),
          type: "runtime.status.get"
        });
      })()
    `);
    const response = runtimeEventSchema.parse(candidate);
    const result = { smoke: "passed", role, bridge: "injected", response };
    await writeSmokeResult(result);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    setTimeout(() => app.quit(), 0);
  }
};

const shutdown = async (): Promise<void> => {
  unsubscribeRuntime?.();
  unsubscribeRuntime = undefined;
  ipcMain.removeHandler("scoutpass:request");
  await Promise.allSettled([runtime?.dispose(), pearHost?.close()]);
  runtime = undefined;
  pearHost = undefined;
};

void app.whenReady().then(async () => {
  try {
    await start();
  } catch (error) {
    if (smokeTest) {
      const message = error instanceof Error ? error.message : "Unknown desktop startup error.";
      await writeSmokeResult({ smoke: "failed", role, message }).catch(() => undefined);
      process.stderr.write(`ScoutPass desktop smoke failed: ${message}\n`);
      process.exitCode = 1;
    }
    await shutdown();
    app.exit(typeof process.exitCode === "number" ? process.exitCode : 1);
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
});

app.on("before-quit", (event) => {
  if (shutdownStarted) return;
  event.preventDefault();
  shutdownStarted = true;
  void shutdown().finally(() => app.quit());
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

function parseRole(args: readonly string[]): AppRole {
  return appRoleSchema.parse(
    readArgument(args, "--role") ?? process.env.SCOUTPASS_ROLE ?? "player"
  );
}

function readArgument(args: readonly string[], name: string): string | undefined {
  const inline = args.find((argument) => argument.startsWith(`${name}=`));
  if (inline !== undefined) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

async function writeSmokeResult(result: object): Promise<void> {
  await mkdir(storageRoot, { recursive: true });
  await writeFile(
    join(storageRoot, "desktop-smoke-result.json"),
    `${JSON.stringify(result, null, 2)}\n`,
    {
      encoding: "utf8",
      mode: 0o600
    }
  );
}
