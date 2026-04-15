import type { AxiosInstance } from 'axios';

export interface PaginatedOptions {
  perPage?: number;
}

export async function* paginate<T>(
  client: AxiosInstance,
  url: string,
  options: PaginatedOptions = {},
  method: 'get' | 'post' = 'get',
  body?: unknown
): AsyncGenerator<T[], void, undefined> {
  const perPage = options.perPage ?? 50;
  let page = 1;
  let totalPages = 1;

  do {
    const params = { perPage, page };
    const response = method === 'post'
      ? await client.post(url, body, { params })
      : await client.get(url, { params });

    const items: T[] = Array.isArray(response.data) ? response.data : [];

    const totalPagesHeader = response.headers['x-total-pages'];
    if (totalPagesHeader) {
      totalPages = parseInt(totalPagesHeader, 10);
    } else if (items.length < perPage) {
      totalPages = page;
    }

    if (items.length > 0) {
      yield items;
    }

    page++;
  } while (page <= totalPages);
}

export async function collectAll<T>(
  generator: AsyncGenerator<T[], void, undefined>
): Promise<T[]> {
  const results: T[] = [];
  for await (const page of generator) {
    results.push(...page);
  }
  return results;
}
