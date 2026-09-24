import { app, BrowserWindow, Menu, nativeTheme, dialog, ipcMain, shell } from "electron";
import { join } from "path";
import { readFile, unlink, writeFile } from "fs/promises";
import { parseInvoice } from "./main/invoice/parse";
import { PrepareRefusal, prepareInvoice } from "./main/invoice/transform";
import { appendLog, initLog, logFilePath } from "./main/log";
import { createZip } from "./shared/zip";
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
import { emptyDetails } from "./shared/ingest";
import { uniqueName } from "./shared/unique";

const reasonOf = (err: unknown): string => (err instanceof Error ? err.message : String(err));

const APP_TITLE = "RTO Invoice Prep v0.1";

let windows: BrowserWindow[] = [];

function registerIpc(): void {
  ipcMain.handle("ingest:pick-files", async (event): Promise<PickedFile[]> => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(win!, {
      title: "Upload invoices",
      filters: [{ name: "Invoice PDFs", extensions: ["pdf"] }],
      properties: ["openFile", "multiSelections"],
    });
    if (result.canceled) return [];
    const files: PickedFile[] = [];
    for (const path of result.filePaths) {
      const data = await readFile(path);
      files.push({
        fileName: path.replace(/\\/g, "/").split("/").pop() ?? path,
        data: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
      });
    }
    return files;
  });

  ipcMain.handle("ingest:parse", async (_event, file: { fileName: string; data: ArrayBuffer }): Promise<ParsedRow> => {
    try {
      const row = await parseInvoice(file.fileName, new Uint8Array(file.data));
      if (row.status === "valid") await appendLog(`OK ${file.fileName} — parsed`);
      else await appendLog(`REFUSED ${file.fileName}: ${row.refusalReason}`);
      return row;
    } catch (err) {
      const reason = reasonOf(err);
      await appendLog(`ERROR ${file.fileName}: parser crash — ${reason}`);
      return {
        fileName: file.fileName,
        status: "error",
        refusalReason: null,
        errorReason: reason,
        details: emptyDetails(),
        totals: null,
      };
    }
  });

  ipcMain.handle("export:save-one", async (event, req: ExportRequest): Promise<ExportResult> => {
    const win = BrowserWindow.fromWebContents(event.sender);
    let prepared: Uint8Array;
    try {
      prepared = await prepareInvoice(new Uint8Array(req.data), { version: app.getVersion() });
    } catch (err) {
      if (err instanceof PrepareRefusal) return { status: "refused", reason: err.message };
      const reason = err instanceof Error ? err.message : String(err);
      return { status: "error", reason };
    }
    const defaultName = `${req.fileName.replace(/\.pdf$/i, "")}-RTO.pdf`;
    const result = await dialog.showSaveDialog(win!, {
      title: "Save prepared invoice",
      defaultPath: defaultName,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (result.canceled || !result.filePath) return { status: "canceled" };
    try {
      await writeFile(result.filePath, prepared);
    } catch (err) {
      const reason = err instanceof PrepareRefusal ? err.message : reasonOf(err);
      await appendLog(`FAILED ${req.fileName} (single save → ${result.filePath}): ${reason}`);
      return { status: "error", reason };
    }
    await appendLog(`OK ${req.fileName} — saved (single) → ${result.filePath}`);
    return { status: "saved", path: result.filePath };
  });

  ipcMain.handle("log:open-log", () => {
    shell.showItemInFolder(logFilePath());
  });

  ipcMain.handle("log:report-bug", () => {
    shell.showItemInFolder(logFilePath());
  });

  ipcMain.handle("export:default-dir", (): string => app.getPath("downloads"));

  ipcMain.handle("export:pick-dir", async (event): Promise<string | null> => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(win!, {
      title: "Choose output folder",
      properties: ["openDirectory", "createDirectory"],
    });
    return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0]!;
  });

  ipcMain.handle("export:check-dir", async (_event, dir: string): Promise<FolderCheck> => {
    const probe = join(dir, `.rto-write-test-${Date.now()}`);
    try {
      await writeFile(probe, "");
      await unlink(probe);
      return { ok: true, reason: null };
    } catch (err) {
      return { ok: false, reason: `cannot write to "${dir}" (${reasonOf(err)})` };
    }
  });

  ipcMain.handle("export:save-batch", async (_event, req: BatchExportRequest): Promise<BatchFileResult[]> => {
    const used = new Set<string>();
    const results: BatchFileResult[] = [];
    for (const file of req.files) {
      try {
        const prepared = await prepareInvoice(new Uint8Array(file.data), { version: app.getVersion() });
        const name = uniqueName(`${file.fileName.replace(/\.pdf$/i, "")}-RTO.pdf`, used);
        const dest = join(req.dir, name);
        await writeFile(dest, prepared);
        await appendLog(`OK ${file.fileName} — exported → ${dest}`);
        results.push({ fileName: file.fileName, status: "saved", path: dest });
      } catch (err) {
        if (err instanceof PrepareRefusal) {
          await appendLog(`REFUSED ${file.fileName}: ${err.message}`);
          results.push({ fileName: file.fileName, status: "error", reason: err.message });
        } else {
          const reason = reasonOf(err);
          await appendLog(`FAILED ${file.fileName}: ${reason}`);
          results.push({ fileName: file.fileName, status: "error", reason });
        }
      }
    }
    return results;
  });

  ipcMain.handle("export:save-zip", async (event, req: ZipExportRequest): Promise<ExportResult> => {
    const used = new Set<string>();
    const entries: { name: string; data: Uint8Array }[] = [];
    for (const file of req.files) {
      try {
        const prepared = await prepareInvoice(new Uint8Array(file.data), { version: app.getVersion() });
        entries.push({ name: uniqueName(`${file.fileName.replace(/\.pdf$/i, "")}-RTO.pdf`, used), data: prepared });
      } catch (err) {
        const kind = err instanceof PrepareRefusal ? "REFUSED" : "FAILED";
        await appendLog(`${kind} ${file.fileName} (zip): ${reasonOf(err)}`);
        return {
          status: err instanceof PrepareRefusal ? "refused" : "error",
          reason: `${file.fileName}: ${reasonOf(err)}`,
        };
      }
    }
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showSaveDialog(win!, {
      title: "Save zip of prepared invoices",
      defaultPath: join(req.dir, req.zipName),
      filters: [{ name: "Zip", extensions: ["zip"] }],
    });
    if (result.canceled || !result.filePath) return { status: "canceled" };
    try {
      await writeFile(result.filePath, createZip(entries));
    } catch (err) {
      const reason = reasonOf(err);
      await appendLog(`FAILED zip (${entries.length} files) → ${result.filePath}: ${reason}`);
      return { status: "error", reason };
    }
    await appendLog(`OK zip — ${entries.length} files → ${result.filePath}`);
    return { status: "saved", path: result.filePath };
  });
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    title: APP_TITLE,
    width: 1180,
    height: 780,
    minWidth: 900,
    minHeight: 600,
    show: false,
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.on("ready-to-show", () => win.show());
  win.on("page-title-updated", (e) => e.preventDefault());
  win.loadFile(join(__dirname, "renderer", "index.html"));

  // Keep the title fixed even if the document ever sets one.
  win.webContents.on("did-finish-load", () => {
    if (win.getTitle() !== APP_TITLE) win.setTitle(APP_TITLE);
  });

  windows.push(win);
  win.on("closed", () => {
    windows = windows.filter((w) => w !== win);
  });

  return win;
}

function buildMenu(): void {
  const isMac = process.platform === "darwin";
  const focused = () => BrowserWindow.getFocusedWindow();

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: "appMenu" as const }] : []),
    {
      label: "&File",
      submenu: [
        {
          label: "&Upload Invoice",
          accelerator: "CmdOrCtrl+O",
          click: () => focused()?.webContents.send("menu:upload-invoice"),
        },
        {
          label: "New &Window",
          accelerator: "CmdOrCtrl+Shift+N",
          click: () => createWindow(),
        },
        { type: "separator" },
        {
          label: "&Quit",
          accelerator: "CmdOrCtrl+Q",
          role: "quit",
        },
      ],
    },
    {
      label: "&View",
      submenu: [
        {
          label: "Zoom &In",
          accelerator: "CmdOrCtrl+=",
          click: () => {
            const wc = focused()?.webContents;
            if (wc) wc.setZoomLevel(Math.min(wc.getZoomLevel() + 0.5, 5));
          },
        },
        {
          label: "Zoom &Out",
          accelerator: "CmdOrCtrl+-",
          click: () => {
            const wc = focused()?.webContents;
            if (wc) wc.setZoomLevel(Math.max(wc.getZoomLevel() - 0.5, -5));
          },
        },
        {
          label: "&Reset Zoom",
          accelerator: "CmdOrCtrl+0",
          click: () => focused()?.webContents.setZoomLevel(0),
        },
        { type: "separator" },
        {
          label: "&Developer Tools",
          accelerator: "F12",
          click: () => focused()?.webContents.toggleDevTools(),
        },
      ],
    },
    {
      label: "&Help",
      submenu: [
        {
          label: "User &guide — Open Log",
          click: () => shell.showItemInFolder(logFilePath()),
        },
        {
          label: "&Report a bug — Check for updates",
          click: () => shell.showItemInFolder(logFilePath()),
        },
        { type: "separator" },
        {
          label: "&About",
          click: () => focused()?.webContents.send("menu:about"),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  nativeTheme.themeSource = "system";
  initLog(app.getPath("userData"));
  registerIpc();
  buildMenu();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
