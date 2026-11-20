import { parseArgs } from 'node:util';
import { formatReport, runDoctor } from './doctor.js';
import { version } from './index.js';

export interface CliIo {
  env: Record<string, string | undefined>;
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  /** Whether stdout is a terminal, to decide on colors. */
  isTTY: boolean;
  /** The fetch used for Graph API calls. Default the global fetch. */
  fetch?: typeof globalThis.fetch;
}

const USAGE = `Usage: cleared <command> [options]

Commands:
  doctor    Check your app before you submit it for Meta App Review

Options:
  --json                Print the report as JSON
  --deletion-url <url>  Send a signed test request to your data deletion callback
  -h, --help            Show this help
  -v, --version         Show the version

The doctor reads META_APP_ID and META_APP_SECRET from the environment
and reads your app settings through the Graph API.
`;

function useColor(io: CliIo): boolean {
  if (io.env.NO_COLOR) return false;
  if (io.env.FORCE_COLOR && io.env.FORCE_COLOR !== '0') return true;
  return io.isTTY && io.env.TERM !== 'dumb';
}

/** Runs the CLI and returns the exit code: 0 when done, 1 on blocking issues, 2 on bad usage. */
export async function main(argv: string[], io: CliIo): Promise<number> {
  let parsed: ReturnType<typeof parse>;
  try {
    parsed = parse(argv);
  } catch (error) {
    io.stderr(`${(error as Error).message}\n\n${USAGE}`);
    return 2;
  }
  const { values, positionals } = parsed;

  if (values.version) {
    io.stdout(`${version}\n`);
    return 0;
  }
  const [command, ...rest] = positionals;
  if (values.help || !command) {
    io.stdout(USAGE);
    return 0;
  }
  if (command !== 'doctor' || rest.length > 0) {
    io.stderr(`Unknown command: ${positionals.join(' ')}\n\n${USAGE}`);
    return 2;
  }

  const report = await runDoctor({
    env: io.env,
    ...(io.fetch && { fetch: io.fetch }),
    ...(values['deletion-url'] !== undefined && { deletionUrl: values['deletion-url'] }),
  });
  io.stdout(
    values.json
      ? `${JSON.stringify(report, null, 2)}\n`
      : formatReport(report, { color: useColor(io) }),
  );
  return report.summary.blocking > 0 ? 1 : 0;
}

function parse(argv: string[]) {
  return parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      json: { type: 'boolean' },
      'deletion-url': { type: 'string' },
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
    },
  });
}
