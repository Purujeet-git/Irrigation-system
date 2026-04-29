const API_AUTH = '/api/auth';

function showToast(text, isError = false) {
  Toastify({
    text: text,
    duration: 3000,
    gravity: "top",
    position: "center",
    style: {
      background: isError ? "linear-gradient(to right, #ef4444, #dc2626)" : "linear-gradient(to right, #10b981, #059669)",
      borderRadius: "12px",
    }
  }).showToast();
}

// Handle Login
const loginForm = document.getElementById('login-form');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    localStorage.clear(); // Clear any old sessions
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
      const res = await fetch(`${API_AUTH}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        window.location.href = data.user.role === 'Admin' ? 'admin.html' : 'farmer.html';
      } else {
        showToast(data.error || 'Login failed', true);
      }
    } catch (err) {
      showToast('Network error, please try again', true);
    }
  });
}

// Handle Register
const registerForm = document.getElementById('register-form');
if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    localStorage.clear(); // Clear any old sessions
    
    const submitBtn = registerForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating Identity...';
    
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const role = 'Farmer'; // Default all new users to Farmer

    try {
      const res = await fetch(`${API_AUTH}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role })
      });

      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        window.location.href = data.user.role === 'Admin' ? 'admin.html' : 'farmer.html';
      } else {
        showToast(data.error || 'Registration failed', true);
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    } catch (err) {
      showToast('Network error, please try again', true);
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });
}
