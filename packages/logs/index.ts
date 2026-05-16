export function createLogger(_name: string) {
  return {
    info: (..._args: unknown[]) => {},
    error: (..._args: unknown[]) => {},
    warn: (..._args: unknown[]) => {},
    debug: (..._args: unknown[]) => {},
  };
}

export const logger = createLogger("app");
