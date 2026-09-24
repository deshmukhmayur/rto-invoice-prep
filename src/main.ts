import { app, BrowserWindow, Menu, nativeTheme, dialog, ipcMain } from "electron";
import { join } from "path";
import { readFile, writeFile } from "fs/promises";
import { parseInvoice } from "./main/invoice/parse";
import { PrepareRefusal, prepareInvoice } from "./main/invoice/transform";
import type { ExportRequest, ExportResult, PickedFile } from "./shared/ingest";

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

  ipcMain.handle("ingest:parse", async (_event, file: { fileName: string; data: ArrayBuffer }) => {
    return parseInvoice(file.fileName, new Uint8Array(file.data));
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
      const reason = err instanceof Error ? err.message : String(err);
      return { status: "error", reason };
    }
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
          click: () => focused()?.webContents.send("menu:open-log"),
        },
        {
          label: "&Report a bug — Check for updates",
          click: () => focused()?.webContents.send("menu:report-bug"),
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
