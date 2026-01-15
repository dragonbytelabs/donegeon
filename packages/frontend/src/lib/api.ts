function apiUrl(path: string) {
  const apiOrigin = (import.meta as any).env?.VITE_DONEGEON_API_ORIGIN as string | undefined;
  return apiOrigin ? new URL(path, apiOrigin).toString() : path;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(apiUrl(path));
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return (await res.json()) as T;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
  return (await res.json()) as T;
}

export async function apiPostWithHeaders<T>(path: string, body: unknown, headers: Record<string, string>): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
  return (await res.json()) as T;
}

export async function apiGetWithHeaders<T>(path: string, headers: Record<string, string>): Promise<T> {
  const res = await fetch(apiUrl(path), { headers });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return (await res.json()) as T;
}
