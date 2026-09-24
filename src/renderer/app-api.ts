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
import type { MenuChannel } from "../channels";

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
      reportBug: () => Promise<void>;
    };
  }
}

export {};
