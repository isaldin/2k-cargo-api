import { AppLogger } from './app-logger.service';

describe('AppLogger', () => {
  let logger: AppLogger;
  let stdoutSpy: jest.SpyInstance;
  let stderrSpy: jest.SpyInstance;

  beforeEach(() => {
    logger = new AppLogger();
    logger.configure({ level: 'info', format: 'json', stacks: false });
    stdoutSpy = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    stderrSpy = jest
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  function lastStdoutJson(): Record<string, unknown> | undefined {
    const last = stdoutSpy.mock.calls.at(-1)?.[0] as string | undefined;
    if (!last) return undefined;
    try {
      return JSON.parse(last);
    } catch {
      return undefined;
    }
  }

  function lastStderrJson(): Record<string, unknown> | undefined {
    const last = stderrSpy.mock.calls.at(-1)?.[0] as string | undefined;
    if (!last) return undefined;
    try {
      return JSON.parse(last);
    } catch {
      return undefined;
    }
  }

  it('writes info logs to stdout', () => {
    logger.info('test.event', { key: 'value' });
    expect(stdoutSpy).toHaveBeenCalled();
    expect(lastStdoutJson()).toMatchObject({
      level: 'info',
      event: 'test.event',
      key: 'value',
    });
  });

  it('writes error logs to stderr', () => {
    logger.errorEvent('test.error', { reason: 'fail' });
    expect(stderrSpy).toHaveBeenCalled();
    expect(lastStderrJson()).toMatchObject({
      level: 'error',
      event: 'test.error',
      reason: 'fail',
    });
  });

  it('filters logs below configured level', () => {
    logger.configure({ level: 'warn', format: 'json', stacks: false });
    logger.info('ignored.event');
    logger.debugEvent('ignored.debug');
    logger.warnEvent('kept.event');
    expect(stdoutSpy).toHaveBeenCalledTimes(1);
    expect(stderrSpy).not.toHaveBeenCalled();
    expect(lastStdoutJson()?.event).toBe('kept.event');
  });

  it('writes debug logs when level is debug', () => {
    logger.configure({ level: 'debug', format: 'json', stacks: false });
    logger.debugEvent('debug.event');
    expect(stdoutSpy).toHaveBeenCalled();
    expect(lastStdoutJson()?.event).toBe('debug.event');
  });

  it('maps Nest log levels without breaking filtering', () => {
    logger.setLogLevels(['log']);
    logger.debugEvent('ignored.debug');
    logger.info('kept.info');
    expect(stdoutSpy).toHaveBeenCalledTimes(1);
    expect(lastStdoutJson()?.event).toBe('kept.info');
  });

  it('keeps only errors when Nest sets fatal and error levels', () => {
    logger.setLogLevels(['fatal', 'error']);
    logger.warnEvent('ignored.warn');
    logger.errorEvent('kept.error');
    expect(stdoutSpy).not.toHaveBeenCalled();
    expect(stderrSpy).toHaveBeenCalledTimes(1);
    expect(lastStderrJson()?.event).toBe('kept.error');
  });

  it('includes timestamp and level in every entry', () => {
    logger.info('test.event');
    const entry = lastStdoutJson();
    expect(entry).toHaveProperty('time');
    expect(entry).toHaveProperty('level', 'info');
    expect(entry?.time).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('outputs pretty format when configured', () => {
    logger.configure({ level: 'info', format: 'pretty', stacks: false });
    logger.info('pretty.event', { key: 'value' });
    const line = stdoutSpy.mock.calls.at(-1)?.[0] as string;
    expect(line).toContain('pretty.event');
    expect(line).toContain('key=value');
  });
});
