import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5000",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// Global response error handling
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    return Promise.reject(
      error?.response?.data || { message: "Network error" },
    );
  },
);

export default api;
