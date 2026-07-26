#!/usr/bin/env node
import { pathToFileURL } from "node:url";

import { CliUsageError, parseTraceArgs, usage } from "./cli/args.js";
import { runAnalyze } from "./commands/analyze.js";

export function main(argv: readonly string[] = process.argv.slice(2)): number {
  if (argv[0] === "--help" || argv[0] === "-h") {
    console.log(usage);
    return 0;
  }

  try {
    const command = parseTraceArgs(argv);
    const result = runAnalyze(command);
    console.log(JSON.stringify(result, null, 2));
    return 0;
  } catch (error) {
    if (error instanceof CliUsageError) {
      console.error(`${error.message}\n\n${usage}`);
      return 1;
    }

    throw error;
  }
}

const invokedPath = process.argv[1];

if (invokedPath !== undefined && import.meta.url === pathToFileURL(invokedPath).href) {
  process.exitCode = main();
}
