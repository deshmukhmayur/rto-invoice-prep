import type {
  BatchExportRequest,
  BatchFileResult,
  ExportRequest,
  ExportResult,
  FolderCheck,
  ParsedRow,
  PickedFile,
  ZipExportRequest,
} from "../shared/ingest";
import type { AppVersions, UpdateCheckResult } from "../shared/app";
import type { MenuChannel } from "../channels";
import type { LogLine } from "../shared/log";

declare global {
  interface Window {
    app: {
      onMenu: (channel: MenuChannel, handler: () => void) => void;
      pickFiles: () => Promise<PickedFile[]>;
      parse: (file: PickedFile) => Promise<ParsedRow>;
      exportOne: (req: ExportRequest) => Promise<ExportResult>;
      defaultFolder: () => Promise<string>;
      pickFolder: () => Promise<string | null>;
      checkFolder: (dir: string) => Promise<FolderCheck>;
      exportBatch: (req: BatchExportRequest) => Promise<BatchFileResult[]>;
      exportZip: (req: ZipExportRequest) => Promise<ExportResult>;
      openLog: () => Promise<void>;
      openLogFolder: () => Promise<void>;
      getSessionLog: () => Promise<LogLine[]>;
      logMonthFile: () => Promise<string>;
      downloadLog: () => Promise<string | null>;
      reportBug: () => Promise<void>;
      versions: () => Promise<AppVersions>;
      openExternal: (url: string) => Promise<void>;
      checkUpdates: () => Promise<UpdateCheckResult>;
    };
  }
}

export {};
