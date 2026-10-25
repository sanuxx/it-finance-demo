# API integration boundary (not implemented yet)

This folder is reserved for REST adapters that will talk to the future NestJS backend.

Nothing in the prototype calls a network endpoint. To introduce the backend:

1. Add a small `httpClient.ts` (fetch wrapper with base URL from `import.meta.env.VITE_API_BASE_URL`,
   auth header injection and error mapping to `DemoValidationError`-style errors).
2. Implement each interface from `src/services/repositories/types.ts`
   (e.g. `InvoiceRepository`) as `api/invoiceApi.ts`.
3. Switch the export in `src/services/index.ts` for that resource.
4. Replace the read hooks in `src/hooks/useData.ts` with TanStack Query (or similar) hooks
   that call the same repositories.

See `docs/FRONTEND_ARCHITECTURE.md` for the resource map.
