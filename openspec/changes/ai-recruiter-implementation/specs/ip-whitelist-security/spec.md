# IP Whitelist Security Specification

## Purpose

IP-based authentication layer that restricts API access to approved IPs/CIDR ranges, enforced as a global NestJS guard.

## Requirements

### Requirement: IP-Based Access Control

The system SHALL enforce IP-based access control on all HTTP requests using a global guard registered in main.ts. Unauthorized requests MUST receive a 403 Forbidden response.

#### Scenario: Allowed single IP

- GIVEN an IP address `192.168.1.100` is present in `src/data/ip-whitelist.json`
- WHEN a request arrives from that IP
- THEN the request proceeds normally with status 200

#### Scenario: Denied IP

- GIVEN an IP address `10.0.0.50` is NOT in the whitelist
- WHEN a request arrives from that IP
- THEN the system responds with HTTP 403 and body `{"statusCode":403,"message":"Access denied. Your IP is not authorized."}`

#### Scenario: CIDR range match

- GIVEN the whitelist contains `172.16.0.0/12`
- WHEN a request arrives from `172.20.5.1`
- THEN the request proceeds (IP falls within CIDR range)

#### Scenario: CIDR range miss

- GIVEN the whitelist contains `172.16.0.0/12`
- WHEN a request arrives from `192.168.1.1`
- THEN the request is denied with HTTP 403

### Requirement: File-Based Whitelist Loading

The system SHALL load the IP whitelist from `src/data/ip-whitelist.json` at startup. The file MUST contain a JSON array of IP addresses and CIDR ranges.

#### Scenario: Valid whitelist file

- GIVEN `src/data/ip-whitelist.json` contains `["192.168.1.100", "10.0.0.0/8"]`
- WHEN the application starts
- THEN the whitelist service loads both entries successfully

#### Scenario: Missing whitelist file

- GIVEN `src/data/ip-whitelist.json` does not exist
- WHEN the application starts
- THEN the system logs a warning and falls back to empty whitelist (all requests denied)

#### Scenario: Invalid JSON in whitelist

- GIVEN `src/data/ip-whitelist.json` contains malformed JSON
- WHEN the application starts
- THEN the system logs an error and falls back to empty whitelist

### Requirement: Hot-Reload Whitelist

The system SHALL detect changes to `ip-whitelist.json` at runtime and reload the whitelist without requiring application restart.

#### Scenario: File updated while running

- GIVEN the application is running with current whitelist
- WHEN `ip-whitelist.json` is modified on disk
- THEN the whitelist service reloads the new entries within 5 seconds
- AND subsequent requests use the updated whitelist

### Requirement: Structured Audit Logging

The system SHALL log all access decisions (allowed/denied) with structured metadata for audit purposes.

#### Scenario: Access allowed logging

- GIVEN an allowed IP makes a request
- WHEN the guard evaluates the request
- THEN the system logs `{"event":"ip_access","ip":"192.168.1.100","decision":"allowed","path":"/api/recruiter/evaluate"}`

#### Scenario: Access denied logging

- GIVEN a denied IP makes a request
- WHEN the guard evaluates the request
- THEN the system logs `{"event":"ip_access","ip":"10.0.0.50","decision":"denied","path":"/api/recruiter/evaluate"}`

### Requirement: Global Guard Registration

The system SHALL register the IP whitelist guard as a global guard in `main.ts` using `app.useGlobalGuards()`. All routes MUST be protected by default.

#### Scenario: Guard applied globally

- GIVEN the application has started
- WHEN any HTTP request is made to any route
- THEN the IP whitelist guard evaluates the request before route handlers execute
