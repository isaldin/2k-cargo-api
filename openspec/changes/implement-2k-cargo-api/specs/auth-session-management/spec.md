## ADDED Requirements

### Requirement: User can log in with phone and password
The system SHALL authenticate the user against the upstream site using a normalized phone number and password and return an opaque Bearer token.

#### Scenario: Successful login
- **WHEN** the user sends a POST request to `/api/auth/login` with a valid phone and password
- **THEN** the system returns HTTP 201 with a JSON body containing a `token`

#### Scenario: Invalid credentials
- **WHEN** the user sends a POST request to `/api/auth/login` with invalid credentials
- **THEN** the system returns HTTP 401 and does not create a session

### Requirement: Phone numbers are normalized
The system SHALL accept phone numbers in `77073006789` or `+7 (707) 300-67-89` formats and store/send them as digits only.

#### Scenario: Formatted phone input
- **WHEN** the user provides `+7 (707) 300-67-89` at login
- **THEN** the system stores and sends `77073006789` upstream

### Requirement: Session is stored securely
The system SHALL store the upstream password encrypted with AES-256-GCM and persist upstream cookies alongside the opaque token.

#### Scenario: New session creation
- **WHEN** login succeeds
- **THEN** the system creates an `ApiSession` row with `token`, `phone`, encrypted `passwordEncrypted`, and `siteCookies`

### Requirement: User can log out
The system SHALL invalidate the API session and call the upstream logout endpoint when the user logs out.

#### Scenario: Successful logout
- **WHEN** an authenticated user sends POST `/api/auth/logout` with a valid Bearer token
- **THEN** the system returns HTTP 204, deletes the session row, and calls upstream `/exit.php`

### Requirement: Sessions are refreshed on use
The system SHALL update `lastUsedAt` every time a session is looked up.

#### Scenario: Authenticated request
- **WHEN** an authenticated request reaches any guarded endpoint
- **THEN** the session `lastUsedAt` timestamp is updated to the current time

### Requirement: Auto-relogin on upstream session expiry
The system SHALL detect upstream session expiry, decrypt the stored password, re-login, update stored cookies, and retry the original request.

#### Scenario: Upstream session expired during list request
- **WHEN** a guarded request fails due to expired upstream cookies
- **THEN** the system decrypts the stored password, re-authenticates upstream, updates the stored cookies, retries the original request, and completes it without returning an error to the client

#### Scenario: Retry limit exceeded
- **WHEN** the upstream session remains expired after the configured maximum number of relogin attempts
- **THEN** the system returns HTTP 401 and does not retry indefinitely
