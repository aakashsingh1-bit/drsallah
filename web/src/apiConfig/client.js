const BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://api.drsalahalzait.me/api/v1";

async function refreshAccessToken() {
  const refreshToken = localStorage.getItem("eduRefreshToken");
  if (!refreshToken) throw new Error("No refresh token");

  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) throw new Error("Session expired");
  const data = await res.json();
  if (!data.accessToken) throw new Error("Session expired");

  localStorage.setItem("eduToken", data.accessToken);
  if (data.refreshToken) localStorage.setItem("eduRefreshToken", data.refreshToken);
  return data.accessToken;
}

export async function api(endpoint, options = {}) {
  let token = localStorage.getItem("eduToken");

  const request = async (accessToken) =>
    fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
        ...options.headers,
      },
    });

  let response = await request(token);

  if (response.status === 401 && token) {
    try {
      token = await refreshAccessToken();
      response = await request(token);
    } catch {
      localStorage.removeItem("eduToken");
      localStorage.removeItem("eduRefreshToken");
      window.location.href = "/login";
      throw new Error("Session expired. Please login again.");
    }
  }

  let data;
  try {
    data = await response.json();
  } catch {
    if (!response.ok) throw new Error(response.statusText || "Request failed");
    return null;
  }

  if (!response.ok) {
    throw new Error(data?.message || "Request failed");
  }

  return data;
}
