import pSeries from "npm:p-series";
import {
	blue,
	dim,
	green,
	magenta,
} from "https://deno.land/std@0.190.0/fmt/colors.ts";

const DENO_ROOT = "https://httpbin.deno.dev";
const PYTHON_ROOT = "https://pie.dev";
const GO_ROOT = "https://httpbun.org";

type BenchmarkEndpoint = string | {
	deno: string;
	python: string;
	go: string;
};

interface BenchmarkOptions {
	/** The method of the `fetch` request */
	method?: string;
	/** The body to provide in the request */
	body?: string;
	/** Headers to provide */
	headers?: { [key: string]: string };

	/** Whether to expect an error code intentionally (such as 401s) */
	expectError?: number;
}

interface BenchmarkResults {
	endpoint: BenchmarkEndpoint;
	denoTime: number;
	pythonTime: number;
	goTime: number;
}

/**
 * Calculate the average of an array of numbers
 *
 * @param arr The array of data
 * @returns The average
 */
const avg = (arr: number[]): number => {
	return arr.reduce((prev, cur) => (prev + cur)) / arr.length;
};

/**
 * Times a request
 *
 * @param url The URL to fetch
 * @param options Benchmarking options
 * @returns The response time
 */
const timeRequest = async (url: string | URL, options: BenchmarkOptions) => {
	const alpha = performance.now();
	const res = await fetch(url, {
		body: options.body,
		method: options.method,
		headers: options.headers,
		redirect: "manual",
	});
	const beta = performance.now();

	if (!res.ok && res.status !== options.expectError) {
		throw new Error(
			`Fetching ${url} failed with status ${res.status} ${res.statusText}`,
		);
	}

	return beta - alpha;
};

const ITERATIONS = 10;
const PROGRESS_BAR_WIDTH = 30;

/** Write a progress bar to the console */
const barFactory = async (
	opts: { url: string; i: number; type: "deno" | "python" | "go" },
) => {
	const filledLength = Math.floor(opts.i / ITERATIONS * PROGRESS_BAR_WIDTH);
	const emptyLength = PROGRESS_BAR_WIDTH - filledLength;

	const fg = opts.type === "deno"
		? blue
		: opts.type === "python"
		? green
		: magenta;

	const bar = "" +
		"\x1B[2K\x1B[0G" +
		"\u001b[1F\x1B[2K\x1B[0G" +
		fg(
			opts.type === "deno"
				? DENO_ROOT
				: opts.type === "python"
				? PYTHON_ROOT
				: GO_ROOT,
		) +
		opts.url +
		"\n" +
		dim("[") +
		fg("=").repeat(filledLength) +
		" ".repeat(emptyLength) +
		dim("] ") +
		`${opts.i}/${ITERATIONS}`;

	await Deno.stdout.write(new TextEncoder().encode(bar));
};

/**
 * Measure the average response time of an endpoint
 *
 * @param endpoint The endpoint along with the type of server being benchmarked
 * @param options Benchmarking options
 * @returns The average response time of the endpoint
 */
const measure = async (
	endpoint: { url: string; type: "deno" | "python" | "go" },
	options: BenchmarkOptions,
) => {
	let i = 0;

	const values: number[] = [];

	await barFactory({ url: endpoint.url, i, type: endpoint.type });

	for (i = 1; i <= ITERATIONS; i++) {
		values.push(
			await timeRequest(
				new URL(
					endpoint.url,
					endpoint.type === "deno"
						? DENO_ROOT
						: endpoint.type === "go"
						? GO_ROOT
						: PYTHON_ROOT,
				),
				options,
			),
		);

		await barFactory({ url: endpoint.url, i, type: endpoint.type });
	}

	return avg(values);
};

/**
 * Measure an endpoint on all servers being benchmarked
 *
 * @param endpoint The absolute endpoint (can provide different endpoints for different servers)
 * @param options Benchmarking options
 */
const benchmark = async (
	endpoint: BenchmarkEndpoint,
	options: BenchmarkOptions = {},
): Promise<BenchmarkResults> => {
	let denoEndpoint: string;
	let pythonEndpoint: string;
	let goEndpoint: string;

	if (typeof endpoint === "string") {
		denoEndpoint = pythonEndpoint = goEndpoint = endpoint;
	} else {
		denoEndpoint = endpoint.deno;
		pythonEndpoint = endpoint.python;
		goEndpoint = endpoint.go;
	}

	const denoTime = await measure(
		{ url: denoEndpoint, type: "deno" },
		options,
	);
	const pythonTime = await measure({
		url: pythonEndpoint,
		type: "python",
	}, options);
	const goTime = await measure({
		url: goEndpoint,
		type: "go",
	}, options);

	return { endpoint, denoTime, pythonTime, goTime };
};

const basicAuthEndpoint: BenchmarkEndpoint = {
	deno: "/auth/basic/hello/world",
	python: "/basic-auth/hello/world",
	go: "/basic-auth/hello/world",
};

const bearerAuthEndpoint: BenchmarkEndpoint = {
	deno: "/auth/bearer",
	python: "/bearer",
	go: "/bearer",
};

await Deno.stdout.write(new TextEncoder().encode("\n"));

const results = await pSeries([
	() =>
		benchmark("/get?a=b&c=d", {
			headers: {
				"X-Test-Header": "ignore this header!",
			},
		}),
	() =>
		benchmark("/post", {
			method: "POST",
			body: JSON.stringify({ a: 2, b: "here's a string", c: null }),
		}),
	() =>
		benchmark("/patch", {
			method: "PATCH",
			body: JSON.stringify({ a: 2, b: "here's a string", c: null }),
		}),
	() =>
		benchmark("/put", {
			method: "PUT",
			body: JSON.stringify({ a: 2, b: "here's a string", c: null }),
		}),
	() =>
		benchmark("/delete", {
			method: "DELETE",
			body: JSON.stringify({ a: 2, b: "here's a string", c: null }),
		}),
	() =>
		benchmark(basicAuthEndpoint, {
			headers: {},
			expectError: 401,
		}),
	() =>
		benchmark(basicAuthEndpoint, {
			headers: { "Authorization": `Basic ${btoa("hello:world")}` },
		}),
	() =>
		benchmark(basicAuthEndpoint, {
			headers: { "Authorization": `Basic ${btoa("no:good")}` },
			expectError: 401,
		}),
	() =>
		benchmark(bearerAuthEndpoint, {
			expectError: 401,
		}),
	() =>
		benchmark(bearerAuthEndpoint, {
			headers: { "Authorization": "Bearer asdfghjkl" },
		}),
	() =>
		benchmark("/status/403", {
			expectError: 403,
		}),
	() =>
		benchmark("/status/500", {
			expectError: 500,
		}),
	() => benchmark("/status/203"),
	() =>
		benchmark("/status/304", {
			expectError: 304,
		}),
	() =>
		benchmark({
			deno: `/redirect?to=${encodeURIComponent("https://deno.land/")}`,
			python: `/redirect-to?url=${encodeURIComponent("https://deno.land/")}`,
			go: `/redirect-to?url=${encodeURIComponent("https://deno.land/")}`,
		}, { expectError: 302 }),
]);

await Deno.stdout.write(new TextEncoder().encode("\n"));

const denoSummary = results.map((k) => k.denoTime);
const pythonSummary = results.map((k) => k.pythonTime);
const goSummary = results.map((k) => k.goTime);

console.group(blue("Deno"));
console.log(
	"average:",
	avg(denoSummary).toFixed(2) + "ms",
);
console.log(
	"min:",
	Math.min(...denoSummary).toFixed(2) + "ms",
);
console.log(
	"max:",
	Math.max(...denoSummary).toFixed(2) + "ms",
);
console.groupEnd();

console.group(green("Python"));
console.log(
	"average:",
	avg(pythonSummary).toFixed(2) + "ms",
);
console.log(
	"min:",
	Math.min(...pythonSummary).toFixed(2) + "ms",
);
console.log(
	"max:",
	Math.max(...pythonSummary).toFixed(2) + "ms",
);
console.groupEnd();

console.group(magenta("Go"));
console.log(
	"average:",
	avg(goSummary).toFixed(2) + "ms",
);
console.log(
	"min:",
	Math.min(...goSummary).toFixed(2) + "ms",
);
console.log(
	"max:",
	Math.max(...goSummary).toFixed(2) + "ms",
);
console.groupEnd();

await Deno.writeTextFile(
	"benchmark.results.json",
	JSON.stringify(results, undefined, "	"),
);

console.log(dim("Saved data to benchmark.results.json"));
