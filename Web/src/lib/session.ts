const DEVICE_KEY = "eduDeviceId";

export function saveAuthSession(response: {
  accessToken: string;
  refreshToken: string;
  user: { _id: string; name: string; email: string; role: string };
}) {
  localStorage.setItem("eduToken", response.accessToken);
  localStorage.setItem("eduRefreshToken", response.refreshToken);
  localStorage.setItem("eduUserId", response.user._id);
  localStorage.setItem("eduUsername", response.user.name);
  localStorage.setItem("eduUserEmail", response.user.email);
  localStorage.setItem("eduUserRole", response.user.role);
}

export function clearAuthSession() {
  [
    "eduToken",
    "eduRefreshToken",
    "eduUserId",
    "eduUsername",
    "eduUserEmail",
    "eduUserRole",
    DEVICE_KEY,
  ].forEach((k) => localStorage.removeItem(k));
}

export function isAuthenticated(): boolean {
  return Boolean(localStorage.getItem("eduToken"));
}
