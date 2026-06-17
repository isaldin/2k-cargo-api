import nock from 'nock';
import { Package } from '../../src/site-client/package.types';

function baseUrl(): string {
  return process.env.SITE_BASE_URL ?? 'https://2k-cargo-krg.kz';
}

function scope(): nock.Scope {
  return nock(baseUrl());
}

export function nockLogin({
  phone,
  password,
  userId = 123,
}: {
  phone: string;
  password: string;
  userId?: number;
}): nock.Scope {
  return scope()
    .post('/login.php', (body: string) => {
      const params = new URLSearchParams(body);
      return (
        params.get('n') === phone &&
        params.get('p') === password &&
        params.get('mem') === '1'
      );
    })
    .reply(302, '', {
      Location: '/index.php',
      'Set-Cookie': [
        'PHPSESSID=test-session-id; path=/',
        `cuid=${userId}; path=/`,
        'cups=test-cups; path=/',
      ],
    });
}

export function nockLoginWrongCredentials({
  phone,
  password,
}: {
  phone: string;
  password: string;
}): nock.Scope {
  return scope()
    .post('/login.php', (body: string) => {
      const params = new URLSearchParams(body);
      return (
        params.get('n') === phone &&
        params.get('p') === password &&
        params.get('mem') === '1'
      );
    })
    .reply(200, 'Invalid credentials');
}

export function nockLoginRedirectWithoutCuid({
  phone,
  password,
}: {
  phone: string;
  password: string;
}): nock.Scope {
  return scope()
    .post('/login.php', (body: string) => {
      const params = new URLSearchParams(body);
      return (
        params.get('n') === phone &&
        params.get('p') === password &&
        params.get('mem') === '1'
      );
    })
    .reply(302, '', {
      Location: '/index.php',
      'Set-Cookie': ['PHPSESSID=test-session-id; path=/'],
    });
}

export function nockLoginRedirectWithNonNumericCuid({
  phone,
  password,
}: {
  phone: string;
  password: string;
}): nock.Scope {
  return scope()
    .post('/login.php', (body: string) => {
      const params = new URLSearchParams(body);
      return (
        params.get('n') === phone &&
        params.get('p') === password &&
        params.get('mem') === '1'
      );
    })
    .reply(302, '', {
      Location: '/index.php',
      'Set-Cookie': [
        'PHPSESSID=test-session-id; path=/',
        'cuid=not-a-number; path=/',
      ],
    });
}

export function nockLogout(): nock.Scope {
  return scope().get('/exit.php').reply(200, 'OK');
}

export function nockLogoutFailure(): nock.Scope {
  return scope()
    .get('/exit.php')
    .replyWithError(new Error('Upstream logout failed'));
}

function buildPackagesHtml(packages: Package[]): string {
  const rows = packages
    .map(
      (pkg) => `
    <tr>
      <td><a href="?delete_item=${pkg.id}"></a></td>
      <td>${pkg.trackCode}</td>
      <td>${pkg.name}</td>
    </tr>
  `,
    )
    .join('');
  return `<html><body><table>${rows}</table></body></html>`;
}

export function nockList({
  page = 1,
  packages = [],
}: {
  page?: number;
  packages?: Package[];
}): nock.Scope {
  return scope()
    .get('/view_verified_codes.php')
    .query({ page })
    .reply(200, buildPackagesHtml(packages), {
      'Content-Type': 'text/html',
    });
}

export function nockListWithPackage({
  page = 1,
  package: pkg,
}: {
  page?: number;
  package: Package;
}): nock.Scope {
  return nockList({ page, packages: [pkg] });
}

export function nockListEmpty({ page = 1 }: { page?: number }): nock.Scope {
  return nockList({ page, packages: [] });
}

export function nockAdd({
  userId,
  trackCode,
  name,
  response = 'OK',
  status = 200,
}: {
  userId: number;
  trackCode: string;
  name: string;
  response?: string;
  status?: number;
}): nock.Scope {
  return scope()
    .post('/process_verification.php', (body: string) => {
      const params = new URLSearchParams(body);
      return (
        params.get('user_id') === String(userId) &&
        params.get('track_code') === trackCode &&
        params.get('names') === name
      );
    })
    .reply(status, response, { 'Content-Type': 'text/plain' });
}

export function nockAddConflict({
  userId,
  trackCode,
  name,
}: {
  userId: number;
  trackCode: string;
  name: string;
}): nock.Scope {
  return nockAdd({
    userId,
    trackCode,
    name,
    response: 'already exists',
  });
}

export function nockDelete({ itemId }: { itemId: number }): nock.Scope {
  return scope()
    .post('/view_verified_codes.php', (body: string) => {
      const params = new URLSearchParams(body);
      return params.get('delete_item') === String(itemId);
    })
    .reply(200, 'OK');
}

export function nockSessionExpired(): nock.Scope {
  return scope()
    .get('/view_verified_codes.php')
    .query(true)
    .reply(302, '', { Location: '/login.php' });
}

export function nockSessionExpiredHtml(): nock.Scope {
  return scope()
    .get('/view_verified_codes.php')
    .query(true)
    .reply(
      200,
      '<html><body><form action="login.php"><input name="n"/></form></body></html>',
      { 'Content-Type': 'text/html' },
    );
}
