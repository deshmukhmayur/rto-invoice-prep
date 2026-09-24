import { app, BrowserWindow, Menu, nativeTheme } from "electron";
import { join } from "path";

const APP_TITLE = "RTO Invoice Prep v0.1";

let windows: BrowserWindow[] = [];

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
  buildMenu();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
