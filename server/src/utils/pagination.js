/**
 * Parse `page` / `limit` query params with hard upper/lower bounds.
 * A client can never request more than `maxLimit` rows per page.
 */
export function paginate(query = {}, { defaultLimit = 20, maxLimit = 100 } = {}) {
  const page = Math.max(1, Math.trunc(Number(query.page)) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Math.trunc(Number(query.limit)) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}