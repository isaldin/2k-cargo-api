import axios, { AxiosError } from 'axios';

const REQUIRED_ENV = [
  'APP_BASE_URL',
  'SMOKE_PHONE',
  'SMOKE_PASSWORD',
  'SMOKE_TRACK_CODE',
  'SMOKE_PACKAGE_NAME',
] as const;

const REQUEST_TIMEOUT_MS = 30_000;

interface SmokeContext {
  token: string | null;
  createdPackageId: number | null;
  baseUrl: string;
}

function fail(message: string): never {
  // eslint-disable-next-line no-console
  console.error(message);
  process.exit(1);
}

function validateEnv(): void {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    fail(
      `UPSTREAM SMOKE FAILED at env\nMissing env: ${missing.join(', ')}\nAll SMOKE_* variables and APP_BASE_URL must be set.`,
    );
  }

  const trackCode = process.env.SMOKE_TRACK_CODE as string;
  if (!trackCode.startsWith('SMOKE-')) {
    fail(
      `UPSTREAM SMOKE FAILED at env\nSMOKE_TRACK_CODE must start with SMOKE- (got: ${trackCode})`,
    );
  }
}

function safeStringify(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function formatFailure(
  step: string,
  status: number | undefined,
  body: unknown,
): string {
  return `UPSTREAM SMOKE FAILED at ${step}\nstatus=${status ?? 'unknown'}\nbody=${safeStringify(body)}`;
}

async function httpRequest<T>(
  step: string,
  method: 'GET' | 'POST' | 'DELETE',
  url: string,
  options: { headers?: Record<string, string>; data?: unknown } = {},
): Promise<{ status: number; data: T }> {
  try {
    const response = await axios({
      method,
      url,
      data: options.data,
      headers: options.headers,
      timeout: REQUEST_TIMEOUT_MS,
      validateStatus: () => true,
    });
    return { status: response.status, data: response.data as T };
  } catch (error) {
    const axiosError = error as AxiosError;
    throw new Error(
      formatFailure(
        step,
        axiosError.response?.status,
        axiosError.response?.data ?? axiosError.message,
      ),
    );
  }
}

async function login(ctx: SmokeContext): Promise<void> {
  const response = await httpRequest<{ token: string }>(
    'login',
    'POST',
    `${ctx.baseUrl}/api/auth/login`,
    {
      data: {
        phone: process.env.SMOKE_PHONE,
        password: process.env.SMOKE_PASSWORD,
      },
    },
  );

  if (response.status !== 201 || !response.data?.token) {
    throw new Error(formatFailure('login', response.status, response.data));
  }

  ctx.token = response.data.token;
}

async function listPackages(ctx: SmokeContext): Promise<void> {
  const response = await httpRequest<unknown[]>(
    'list',
    'GET',
    `${ctx.baseUrl}/api/packages?page=1`,
    {
      headers: { Authorization: `Bearer ${ctx.token}` },
    },
  );

  if (response.status !== 200 || !Array.isArray(response.data)) {
    throw new Error(formatFailure('list', response.status, response.data));
  }
}

async function createPackage(ctx: SmokeContext): Promise<void> {
  const response = await httpRequest<{
    id: number;
    trackCode: string;
    name: string;
  }>('create', 'POST', `${ctx.baseUrl}/api/packages`, {
    headers: { Authorization: `Bearer ${ctx.token}` },
    data: {
      trackCode: process.env.SMOKE_TRACK_CODE,
      name: process.env.SMOKE_PACKAGE_NAME,
    },
  });

  const trackCode = process.env.SMOKE_TRACK_CODE as string;
  const name = process.env.SMOKE_PACKAGE_NAME as string;

  if (
    response.status !== 201 ||
    typeof response.data?.id !== 'number' ||
    response.data.trackCode !== trackCode ||
    response.data.name !== name
  ) {
    throw new Error(formatFailure('create', response.status, response.data));
  }

  ctx.createdPackageId = response.data.id;
}

async function getPackage(ctx: SmokeContext): Promise<void> {
  if (ctx.createdPackageId === null) {
    throw new Error(formatFailure('get', undefined, 'no created package id'));
  }

  const response = await httpRequest<{
    id: number;
    trackCode: string;
    name: string;
  }>('get', 'GET', `${ctx.baseUrl}/api/packages/${ctx.createdPackageId}`, {
    headers: { Authorization: `Bearer ${ctx.token}` },
  });

  const trackCode = process.env.SMOKE_TRACK_CODE as string;
  const name = process.env.SMOKE_PACKAGE_NAME as string;

  if (
    response.status !== 200 ||
    response.data?.id !== ctx.createdPackageId ||
    response.data.trackCode !== trackCode ||
    response.data.name !== name
  ) {
    throw new Error(formatFailure('get', response.status, response.data));
  }
}

async function deletePackage(
  ctx: SmokeContext,
): Promise<{ ok: boolean; skipped: boolean; message: string }> {
  if (ctx.createdPackageId === null) {
    return { ok: false, skipped: true, message: 'skipped (no package id)' };
  }

  const response = await httpRequest<unknown>(
    'delete',
    'DELETE',
    `${ctx.baseUrl}/api/packages/${ctx.createdPackageId}`,
    {
      headers: { Authorization: `Bearer ${ctx.token}` },
    },
  );

  if (response.status !== 204) {
    return {
      ok: false,
      skipped: false,
      message: `failed status=${response.status} body=${safeStringify(response.data)}`,
    };
  }

  ctx.createdPackageId = null;
  return { ok: true, skipped: false, message: 'ok' };
}

async function logout(
  ctx: SmokeContext,
): Promise<{ ok: boolean; skipped: boolean; message: string }> {
  if (ctx.token === null) {
    return { ok: false, skipped: true, message: 'skipped (no token)' };
  }

  const response = await httpRequest<unknown>(
    'logout',
    'POST',
    `${ctx.baseUrl}/api/auth/logout`,
    {
      headers: { Authorization: `Bearer ${ctx.token}` },
    },
  );

  if (response.status !== 204) {
    return {
      ok: false,
      skipped: false,
      message: `failed status=${response.status} body=${safeStringify(response.data)}`,
    };
  }

  ctx.token = null;
  return { ok: true, skipped: false, message: 'ok' };
}

async function runSmoke(): Promise<void> {
  validateEnv();

  const baseUrl = (process.env.APP_BASE_URL as string).replace(/\/$/, '');
  const trackCode = process.env.SMOKE_TRACK_CODE as string;

  const ctx: SmokeContext = {
    token: null,
    createdPackageId: null,
    baseUrl,
  };

  let mainError: Error | null = null;

  try {
    await login(ctx);
    await listPackages(ctx);
    await createPackage(ctx);
    await getPackage(ctx);
    await deletePackage(ctx);
    await logout(ctx);

    // eslint-disable-next-line no-console
    console.log('UPSTREAM SMOKE OK');
    // eslint-disable-next-line no-console
    console.log('login: ok');
    // eslint-disable-next-line no-console
    console.log('list: ok');
    // eslint-disable-next-line no-console
    console.log(`create: ok id=${ctx.createdPackageId} trackCode=${trackCode}`);
    // eslint-disable-next-line no-console
    console.log('get: ok');
    // eslint-disable-next-line no-console
    console.log('delete: ok');
    // eslint-disable-next-line no-console
    console.log('logout: ok');
  } catch (error) {
    mainError = error as Error;
  } finally {
    if (mainError) {
      const deleteResult = await deletePackage(ctx);
      const logoutResult = await logout(ctx);

      // eslint-disable-next-line no-console
      console.error(mainError.message);
      // eslint-disable-next-line no-console
      console.error('cleanup:');
      // eslint-disable-next-line no-console
      console.error(`delete: ${deleteResult.message}`);
      // eslint-disable-next-line no-console
      console.error(`logout: ${logoutResult.message}`);

      process.exitCode = 1;
      return;
    }
  }
}

void runSmoke();
