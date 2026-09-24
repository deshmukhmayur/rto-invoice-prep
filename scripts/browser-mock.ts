// Dev-only browser mock of the preload API (see scripts/dev-server.ts).
// Never loaded by the Electron app — index.html only references renderer.js.
import type { MenuChannel } from "../src/channels";

declare global {
  interface Window {
    app: {
      onMenu: (channel: MenuChannel, handler: () => void) => void;
    };
  }
}

document.title = "RTO Invoice Prep v0.1 (browser dev)";

window.app = {
  onMenu: (channel) => console.log(`[browser dev mock] ${channel}`),
};
