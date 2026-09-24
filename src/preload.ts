import { contextBridge, ipcRenderer } from "electron";
import { MENU_CHANNELS, type MenuChannel } from "./channels";
import type { ExportRequest, ExportResult, ParsedRow, PickedFile } from "./shared/ingest";

contextBridge.exposeInMainWorld("app", {
  onMenu: (channel: MenuChannel, handler: () => void): void => {
    if (!MENU_CHANNELS.includes(channel)) return;
    ipcRenderer.on(channel, () => handler());
  },
  pickFiles: (): Promise<PickedFile[]> => ipcRenderer.invoke("ingest:pick-files"),
  parse: (file: PickedFile): Promise<ParsedRow> =>
    ipcRenderer.invoke("ingest:parse", file),
  exportOne: (req: ExportRequest): Promise<ExportResult> =>
    ipcRenderer.invoke("export:save-one", req),
});
