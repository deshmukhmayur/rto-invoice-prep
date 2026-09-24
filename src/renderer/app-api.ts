import type { ExportRequest, ExportResult, ParsedRow, PickedFile } from "../shared/ingest";
import type { MenuChannel } from "../channels";

declare global {
  interface Window {
    app: {
      onMenu: (channel: MenuChannel, handler: () => void) => void;
      pickFiles: () => Promise<PickedFile[]>;
      parse: (file: PickedFile) => Promise<ParsedRow>;
      exportOne: (req: ExportRequest) => Promise<ExportResult>;
    };
  }
}

export {};
