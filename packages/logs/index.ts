export function createLogger(_name: string) {
  return {
    log: (..._args: unknown[]) => { console.log(..._args); },
    info: (..._args: unknown[]) => { console.log(..._args); },
    error: (..._args: unknown[]) => { console.error(..._args); },
    warn: (..._args: unknown[]) => { console.warn(..._args); },
    debug: (..._args: unknown[]) => { console.log(..._args); },
  };
}

export const logger = createLogger("app");
