import pSeries from 'https://cdn.skypack.dev/p-series@3.0.0?dts';

const DENO_ROOT = 'https://httpbin.deno.dev';
const CLASSIC_ROOT = 'https://pie.dev';

type BenchmarkEndpoint = string | {
  deno: string;
  classic: string;
};
type BenchmarkOptions = {
  /** The method of the `fetch` request */
  method?: string;
  /** The body to provide in the request */
  body?: string;
  /** Headers to provide */
  headers?: { [key: string]: string };

  /** Whether to expect an error code intentionally (such as 401s) */
  expectError?: number;
};
type BenchmarkResults = {
  endpoint: BenchmarkEndpoint;
  denoTime: number;
  classicTime: number;
};

/** Time a request */
const timeRequest = async (url: string, options: BenchmarkOptions) => {
  const alpha = performance.now();
  const res = await fetch(url, {
    body: options.body,
    method: options.method,
    headers: options.headers,
  });
  const beta = performance.now();

  if (!res.ok && res.status !== options.expectError) {
    throw new Error(
      `Fetching ${url} failed with status ${res.status} ${res.statusText}`,
    );
  }

  return beta - alpha;
};

/** Repeat an async function for many times and take the average of the numbers */
const repeatAndAverage = async (promiseFactory: () => Promise<number>) => {
  const values: number[] = [];
  const getAverage =
    () => (values.reduce((prev, cur) => (prev + cur)) / values.length);

  await Deno.stdout.write(new TextEncoder().encode('timing requests... '));

  for (let _ = 1; _ <= 10; _++) {
    values.push(await promiseFactory());

    await Deno.stdout.write(
      new TextEncoder().encode(
        `${_ !== 1 ? '\rtiming requests... ' : ''}${
          _ < 10 ? ' ' : ''
        }${_} / 10 - currently ${getAverage().toFixed(2)}ms`,
      ),
    );
  }

  await Deno.stdout.write(new TextEncoder().encode('\n'));

  return getAverage();
};

/**
 * Benchmark an endpoint
 *
 * @param endpoint The absolute endpoint (can provide different endpoints for Deno and Classic)
 * @param options Options to provide for benchmarking
 */
const benchmark = async (
  endpoint: BenchmarkEndpoint,
  options: BenchmarkOptions = {},
): Promise<BenchmarkResults> => {
  let denoEndpoint: string;
  let classicEndpoint: string;

  if (typeof endpoint === 'string') {
    denoEndpoint = classicEndpoint = endpoint;
  } else {
    denoEndpoint = endpoint.deno;
    classicEndpoint = endpoint.classic;
  }

  // const denoTime = await timeRequest(DENO_ROOT + denoEndpoint, options);
  // const classicTime = await timeRequest(
  //   CLASSIC_ROOT + classicEndpoint,
  //   options,
  // );
  const denoTime = await repeatAndAverage(() =>
    timeRequest(DENO_ROOT + denoEndpoint, options)
  );
  const classicTime = await repeatAndAverage(() =>
    timeRequest(
      CLASSIC_ROOT + classicEndpoint,
      options,
    )
  );

  return { endpoint, denoTime, classicTime };
};

const basicAuthEndpoint: BenchmarkEndpoint = {
  deno: '/auth/basic/hello/world',
  classic: '/basic-auth/hello/world',
};

const bearerAuthEndpoint: BenchmarkEndpoint = {
  deno: '/auth/bearer',
  classic: '/bearer',
};

const results = await pSeries([
  () =>
    benchmark('/get?a=b&c=d', {
      headers: {
        'X-Test-Header': 'ignore this header!',
      },
    }),
  () =>
    benchmark('/post', {
      method: 'POST',
      body: JSON.stringify({ a: 2, b: 'here\'s a string', c: null }),
    }),
  () =>
    benchmark('/patch', {
      method: 'PATCH',
      body: JSON.stringify({ a: 2, b: 'here\'s a string', c: null }),
    }),
  () =>
    benchmark('/put', {
      method: 'PUT',
      body: JSON.stringify({ a: 2, b: 'here\'s a string', c: null }),
    }),
  () =>
    benchmark('/delete', {
      method: 'DELETE',
      body: JSON.stringify({ a: 2, b: 'here\'s a string', c: null }),
    }),
  () =>
    benchmark(basicAuthEndpoint, {
      headers: {},
      expectError: 401,
    }),
  () =>
    benchmark(basicAuthEndpoint, {
      headers: { 'Authorization': `Basic ${btoa('hello:world')}` },
    }),
  () =>
    benchmark(basicAuthEndpoint, {
      headers: { 'Authorization': `Basic ${btoa('no:good')}` },
      expectError: 401,
    }),
  () =>
    benchmark(bearerAuthEndpoint, {
      expectError: 401,
    }),
  () =>
    benchmark(bearerAuthEndpoint, {
      headers: { 'Authorization': 'Bearer asdfghjkl' },
    }),

  () =>
    benchmark('/status/403', {
      expectError: 403,
    }),
  () =>
    benchmark('/status/500', {
      expectError: 500,
    }),
  () => benchmark('/status/203'),
  () =>
    benchmark('/status/304', {
      expectError: 304,
    }),
  () =>
    benchmark({
      deno: `/redirect?to=${encodeURIComponent('https://deno.land/')}`,
      classic: `/redirect-to?url=${encodeURIComponent('https://deno.land/')}`,
    }),
]);

await Deno.writeTextFile('benchmark.results.json', JSON.stringify(results));
