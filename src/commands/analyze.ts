import type { AnalyzeCommand } from "../cli/args.js";

export interface AnalyzeParseResult {
  readonly command: "analyze";
  readonly input: string;
  readonly out: string;
  readonly status: "parsed";
}

export function runAnalyze(command: AnalyzeCommand): AnalyzeParseResult {
  return {
    command: command.command,
    input: command.input,
    out: command.out,
    status: "parsed"
  };
}
