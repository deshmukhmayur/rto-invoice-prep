import type { MenuChannel } from "../channels";

declare global {
  interface Window {
    app: {
      onMenu: (channel: MenuChannel, handler: () => void) => void;
    };
  }
}

window.app.onMenu("menu:upload-invoice", () => {
  // Wire-up arrives with ingest (ticket 14); menus are verified working via IPC delivery.
  console.log("menu:upload-invoice");
});
window.app.onMenu("menu:open-log", () => console.log("menu:open-log"));
window.app.onMenu("menu:report-bug", () => console.log("menu:report-bug"));
window.app.onMenu("menu:about", () => console.log("menu:about"));
