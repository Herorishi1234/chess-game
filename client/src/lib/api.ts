import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) { // this is added to refresh the token in the header for every request, so if the token is updated in localStorage, it will be used in subsequent requests
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});


// This code redirects to login if a 401 response is received

// api.interceptors.response.use(
//   (response) => response, // If the request succeeds, just return it
//   (error) => {
//     if (error.response && error.response.status === 401) {
//       // Token is expired or invalid
//       localStorage.removeItem('token');
//       window.location.href = '/login'; // Send them back to login
//     }
//     return Promise.reject(error);
//   }
// );

export default api;


// XSS (Cross-Site Scripting) this attack can happen as we are storing tokens in localStorage which is accessible via JavaScript. An attacker who manages to inject malicious scripts into our application could potentially access these tokens and compromise user accounts. To mitigate this risk, consider using HttpOnly cookies for storing tokens, as they are not accessible via JavaScript. Additionally, always sanitize and validate any user-generated content to prevent script injection.

// this attack can be avoided by using httpOnly cookies instead of localStorage to store tokens. HttpOnly cookies are not accessible via JavaScript, which helps protect against XSS attacks. Additionally, implementing Content Security Policy (CSP) headers can help mitigate the risk of XSS by restricting the sources from which scripts can be loaded.