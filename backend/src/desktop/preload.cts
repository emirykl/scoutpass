import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

contextBridge.exposeInMainWorld(
  "scoutpassRuntime",
  Object.freeze({
    request: (command: unknown): Promise<unknown> =>
      ipcRenderer.invoke("scoutpass:request", command),
    subscribe: (listener: (event: unknown) => void): (() => void) => {
      if (typeof listener !== "function") {
        throw new TypeError("Runtime event listener must be a function.");
      }
      const wrapped = (_ipcEvent: IpcRendererEvent, event: unknown): void => listener(event);
      ipcRenderer.on("scoutpass:event", wrapped);
      return () => ipcRenderer.removeListener("scoutpass:event", wrapped);
    }
  })
);
