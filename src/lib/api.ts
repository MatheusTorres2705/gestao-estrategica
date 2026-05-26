import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3201',
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const t = localStorage.getItem('auth:token');
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

let _refreshing: Promise<string> | null = null;

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }
    original._retry = true;

    try {
      if (!_refreshing) {
        _refreshing = api
          .post('/api/auth/refresh')
          .then((res) => {
            const t = res.data.token as string;
            localStorage.setItem('auth:token', t);
            api.defaults.headers.common['Authorization'] = `Bearer ${t}`;
            return t;
          })
          .finally(() => { _refreshing = null; });
      }

      const newToken = await _refreshing;
      original.headers = { ...original.headers, Authorization: `Bearer ${newToken}` };
      return api(original);
    } catch {
      localStorage.removeItem('auth:token');
      localStorage.removeItem('auth:name');
      delete api.defaults.headers.common['Authorization'];
      window.dispatchEvent(new CustomEvent('auth:logout'));
      return Promise.reject(error);
    }
  },
);
