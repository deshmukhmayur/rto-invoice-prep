import { contextBridge, ipcRenderer } from "electron";
import { MENU_CHANNELS, type MenuChannel } from "./channels";

contextBridge.exposeInMainWorld("app", {
  onMenu: (channel: MenuChannel, handler: () => void): void => {
    if (!MENU_CHANNELS.includes(channel)) return;
    ipcRenderer.on(channel, () => handler());
  },
});
