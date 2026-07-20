// Next.js remaps the "server-only" package to a no-op via the "react-server"
// export condition at build time; Vitest doesn't understand that condition,
// so it's aliased here instead (see vitest.config.ts resolve.alias).
export {};
