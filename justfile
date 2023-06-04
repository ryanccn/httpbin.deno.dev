dev:
	deno run -A --watch mod.ts
lint:
	deno lint mod.ts
benchmark:
	deno run -A _benchmark.ts
