# ADR 0002: MVP local application storage

- Status: accepted
- Date: 2026-07-14

## Decision

Use strict structured JSON behind repository interfaces for normal application records in the first MVP.

- Each Player/Scout instance receives an isolated data file.
- Writes use a same-directory temporary file followed by atomic rename.
- The complete persisted shape is validated with strict Zod schemas before every write and after every read.
- Unknown schema versions fail explicitly. Registered sequential migrations are the only supported upgrade path.
- Corrupt JSON produces a typed error and is never silently replaced.
- File mode is requested as owner-only (`0600`) when created.
- Seed phrases and private keys have no field in the persistence schema; strict validation rejects them.

P2P replication state will use Pear-managed Corestore/Hypercore storage in the Bare worker. Wallet secret storage is a separate decision for the WDK phase and must use an operating-system secure facility rather than this database.

## Why not SQLite now?

The current MVP record volume is small, structured JSON is permitted by the product requirements, and repository boundaries allow a later SQLite adapter without changing use cases. Avoiding a second native database dependency reduces Pear/Bare packaging risk before the critical P2P integration is proven.
