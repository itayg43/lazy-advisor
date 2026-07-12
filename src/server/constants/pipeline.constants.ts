// Our fault — an unexpected failure (a bug) bubbled to the orchestrator's
// top-level catch. Deliberately generic to avoid leaking internals.
export const SYSTEM_ERROR_EXIT_MESSAGE =
  "Something went wrong on our end — please try again later.";

// Not our fault — a phase caught an upstream dependency failing (down, or a bad
// response) and reported it in-band as `errored`. Transient, so we invite a
// sooner retry, distinct from the generic our-end message above.
export const SERVICE_UNAVAILABLE_EXIT_MESSAGE =
  "We're having trouble reaching a service we rely on right now — please try again in a few minutes.";
