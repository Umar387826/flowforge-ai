import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { AppRoutes } from '../App';
import { LoginPage } from '../pages/auth/LoginPage';
import { RegisterPage } from '../pages/auth/RegisterPage';

describe('Authentication Forms & Protected Routes', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'ok' }), { status: 200 })),
    );
  });

  it('redirects unauthenticated users from /dashboard to /login', async () => {
    window.history.pushState({}, '', '/dashboard');
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/dashboard']}>
          <AppRoutes />
        </MemoryRouter>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Sign in to your workspace')).toBeInTheDocument();
    });
  });

  it('validates login email and password before calling API', async () => {
    render(
      <AuthProvider>
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </AuthProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));
    expect(await screen.findByText('Enter a valid work email address.')).toBeInTheDocument();
  });

  it('validates registration password length and organization name', async () => {
    render(
      <AuthProvider>
        <MemoryRouter>
          <RegisterPage />
        </MemoryRouter>
      </AuthProvider>,
    );

    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Alex Rivera' } });
    fireEvent.change(screen.getByLabelText('Company / Organization Name'), { target: { value: 'Apex Realty' } });
    fireEvent.change(screen.getByLabelText('Work Email'), { target: { value: 'alex@apex.com' } });
    fireEvent.change(screen.getByLabelText('Password (minimum 10 characters)'), { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Workspace' }));

    expect(await screen.findByText('Password must be at least 10 characters.')).toBeInTheDocument();
  });
});
