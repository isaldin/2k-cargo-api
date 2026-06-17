## ADDED Requirements

### Requirement: Site client authenticates against upstream login form
The system SHALL POST `n`, `p`, and `mem=1` to `/login.php` and extract the upstream user id and cookies from the response.

#### Scenario: Valid credentials
- **WHEN** `SiteClientService.login` is called with a valid phone and password
- **THEN** it returns `{ userId, cookies }` where `cookies` serializes the received `PHPSESSID`, `cuid`, and `cups`

#### Scenario: Invalid credentials
- **WHEN** `SiteClientService.login` is called with invalid credentials
- **THEN** it throws an `UnauthorizedException`

### Requirement: Site client restores sessions from stored cookies
The system SHALL recreate a `tough-cookie` CookieJar from the stored cookie string for each authenticated request.

#### Scenario: Reused session
- **WHEN** an existing session's cookies are loaded into the site client
- **THEN** subsequent upstream requests include the stored cookies

### Requirement: Site client lists packages from HTML
The system SHALL fetch `/view_verified_codes.php?page={N}` and parse package cards into structured objects.

#### Scenario: Parse packages page
- **WHEN** `SiteClientService.listPackages` is called with valid cookies
- **THEN** it returns an array of `{ id, trackCode, name }` objects

### Requirement: Site client adds packages
The system SHALL POST `user_id`, `track_code`, and `names` to `/process_verification.php`.

#### Scenario: Successful add
- **WHEN** `SiteClientService.addPackage` is called with valid parameters
- **THEN** it posts the new package to the upstream site

#### Scenario: Resolve id after add
- **WHEN** `SiteClientService.addPackage` completes
- **THEN** the caller MAY call `listPackages` and match by `trackCode` to discover the upstream item id assigned to the new package

### Requirement: Site client deletes packages
The system SHALL POST `delete_item={item_id}` to `/view_verified_codes.php`.

#### Scenario: Successful delete
- **WHEN** `SiteClientService.deletePackage` is called with a valid item id
- **THEN** it completes without error

### Requirement: Site client logs out upstream
The system SHALL call `/exit.php` to invalidate upstream cookies.

#### Scenario: Logout
- **WHEN** `SiteClientService.logout` is called
- **THEN** it requests `/exit.php` with the session cookies

### Requirement: Site client detects session expiry
The system SHALL recognize upstream responses that indicate an expired session and signal the caller to re-login.

#### Scenario: Expired session on list
- **WHEN** an upstream request returns content indicating the user is not logged in
- **THEN** `SiteClientService` throws a retriable session-expired error
