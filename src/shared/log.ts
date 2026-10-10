export type LogKind = "OK" | "REFUSED" | "FAILED" | "ERROR";

export interface LogLine {
  kind: LogKind;
  time: string;
  text: string;
}
