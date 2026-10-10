export const MENU_CHANNELS = [
  "menu:upload-invoice",
  "menu:user-guide",
  "menu:open-log",
  "menu:report-bug",
  "menu:check-updates",
  "menu:about",
  "menu:export-batch",
  "menu:export-zip",
  "menu:choose-folder",
] as const;

export type MenuChannel = (typeof MENU_CHANNELS)[number];
