export const MENU_CHANNELS = [
  "menu:upload-invoice",
  "menu:user-guide",
  "menu:open-log",
  "menu:report-bug",
  "menu:check-updates",
  "menu:about",
] as const;

export type MenuChannel = (typeof MENU_CHANNELS)[number];
