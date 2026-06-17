## ADDED Requirements

### Requirement: User can list packages
The system SHALL return a paginated list of the authenticated user's packages parsed from the upstream `view_verified_codes.php` HTML response.

#### Scenario: List first page
- **WHEN** the user sends GET `/api/packages?page=1`
- **THEN** the system returns HTTP 200 with an array of package objects

#### Scenario: Default page
- **WHEN** the user sends GET `/api/packages` without a page query
- **THEN** the system returns HTTP 200 with the first page of packages

### Requirement: User can add a package
The system SHALL create a new track code on the upstream site for the authenticated user.

#### Scenario: Successful package creation
- **WHEN** the user sends POST `/api/packages` with `trackCode` and `name`
- **THEN** the system creates the package upstream and returns HTTP 201 with the created package object

##### Note: Resolving the created package id
Because the upstream add endpoint returns plain text, the system SHALL refetch the package list and match the newly created package by `trackCode` to determine its upstream item id.

#### Scenario: Duplicate track code
- **WHEN** the user attempts to add a track code that already exists upstream
- **THEN** the system returns HTTP 409 with a clear error message

### Requirement: User can view a single package
The system SHALL return the details of a specific package by its upstream item id. Because the upstream site only exposes a paginated list, the system SHALL scan package pages sequentially (starting at page 1) until the requested id is found or a configurable page limit is reached.

#### Scenario: Existing package on the first page
- **WHEN** the user sends GET `/api/packages/:id` for an existing package that is present on the first page
- **THEN** the system returns HTTP 200 with the package object

#### Scenario: Existing package on a later page
- **WHEN** the user sends GET `/api/packages/:id` for an existing package that appears within the configured scan limit
- **THEN** the system returns HTTP 200 with the package object

#### Scenario: Missing package
- **WHEN** the user sends GET `/api/packages/:id` for a non-existent package or a package beyond the configured scan limit
- **THEN** the system returns HTTP 404

### Requirement: User can delete a package
The system SHALL delete the package on the upstream site by posting `delete_item` to `view_verified_codes.php`.

#### Scenario: Successful deletion
- **WHEN** the user sends DELETE `/api/packages/:id`
- **THEN** the system returns HTTP 204

### Requirement: User can update a package
The system SHALL emulate an update by deleting the existing upstream package and creating a new one with the updated fields. This is not atomic; if the create step fails after the delete step, the original package is lost.

#### Scenario: Successful update
- **WHEN** the user sends PATCH `/api/packages/:id` with updated `trackCode` and/or `name`
- **THEN** the system returns HTTP 200 with the new package object, which has a different id than the original

#### Scenario: Delete succeeds but create fails
- **WHEN** the system deletes the old package but the upstream create request fails
- **THEN** the system returns HTTP 502 and the package no longer exists

### Requirement: Package ids reflect upstream identifiers
The system SHALL expose upstream item ids as package ids in API responses.

#### Scenario: List response
- **WHEN** the user lists packages
- **THEN** each package object includes `id`, `trackCode`, and `name` from the parsed upstream HTML
