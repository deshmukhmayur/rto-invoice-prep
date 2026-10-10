import { contextBridge, ipcRenderer } from "electron";
import { MENU_CHANNELS, type MenuChannel } from "./channels";
import type { LogLine } from "./shared/log";
import type {
  BatchExportRequest,
  BatchFileResult,
  ExportRequest,
  ExportResult,
  FolderCheck,
  ParsedRow,
  PickedFile,
  ZipExportRequest,
} from "./shared/ingest";

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
  defaultFolder: (): Promise<string> => ipcRenderer.invoke("export:default-dir"),
  pickFolder: (): Promise<string | null> => ipcRenderer.invoke("export:pick-dir"),
  checkFolder: (dir: string): Promise<FolderCheck> => ipcRenderer.invoke("export:check-dir", dir),
  exportBatch: (req: BatchExportRequest): Promise<BatchFileResult[]> =>
    ipcRenderer.invoke("export:save-batch", req),
  exportZip: (req: ZipExportRequest): Promise<ExportResult> =>
    ipcRenderer.invoke("export:save-zip", req),
  openLog: (): Promise<void> => ipcRenderer.invoke("log:open-log"),
  openLogFolder: (): Promise<void> => ipcRenderer.invoke("log:open-dir"),
  getSessionLog: (): Promise<LogLine[]> => ipcRenderer.invoke("log:get-session"),
  logMonthFile: (): Promise<string> => ipcRenderer.invoke("log:month-file"),
  downloadLog: (): Promise<string | null> => ipcRenderer.invoke("log:download"),
  reportBug: (): Promise<void> => ipcRenderer.invoke("log:report-bug"),
});
