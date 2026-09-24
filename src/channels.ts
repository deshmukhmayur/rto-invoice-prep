export const MENU_CHANNELS = [
  "menu:upload-invoice",
  "menu:open-log",
  "menu:report-bug",
  "menu:about",
] as const;

export type MenuChannel = (typeof MENU_CHANNELS)[number];
