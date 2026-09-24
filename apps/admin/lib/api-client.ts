const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface RequestOptions extends RequestInit {
  token?: string;
  params?: Record<string, string | number | boolean | undefined>;
}

export async function adminFetch<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { token, params, headers, ...rest } = options;

  let url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, String(value));
      }
    }
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  const reqHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string>),
  };

  if (token) {
    reqHeaders['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...rest,
    headers: reqHeaders,
  });

  if (!response.ok) {
    let errorDetail = response.statusText;
    try {
      const errJson = await response.json();
      errorDetail = errJson.message || errJson.error || errorDetail;
    } catch {
      // Ignore text parse errors
    }
    throw new Error(`API Error [${response.status}]: ${errorDetail}`);
  }

  return response.json();
}
