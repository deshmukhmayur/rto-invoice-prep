/** Runtime versions for the About modal, gathered in the main process. */
export type AppVersions = {
  app: string;
  electron: string;
  chrome: string;
  node: string;
};

/** Result of an update check — failures render in the error color. */
export type UpdateCheckResult = {
  kind: "ok" | "error";
  text: string;
};
