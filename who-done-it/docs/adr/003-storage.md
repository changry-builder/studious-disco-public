# ADR-003: Saves use localStorage behind an interface

Status: accepted

## Decision

Saves go to `localStorage`, through a `SaveStore` interface, written synchronously after every action. Each value is wrapped with a schema version.

## Why

- The requirement is "closing the app mid-case loses nothing". A synchronous write inside `dispatch` has finished before the tap handler returns. IndexedDB writes are asynchronous and can be cut off when iOS suspends the page.
- A save is small: a case snapshot (tens of kilobytes) and a list of actions (a few kilobytes). The roughly 5 MB limit is far away.
- No dependency and nothing to mock in tests beyond a plain object.

## What we accept

- Storage is per device. There is no backup or transfer of an in-progress case. A finished result can be shared as a result code.
- Both localStorage and IndexedDB can be evicted by iOS for a site that is not installed. See ADR-001.

## If this stops being enough

The `SaveStore` interface is the only place that knows about `localStorage`. Swapping in IndexedDB later (for many saved cases, or large assets) means writing one new implementation and making `dispatch` await it.
