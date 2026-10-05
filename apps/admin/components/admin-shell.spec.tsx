import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSignOut, state } = vi.hoisted(() => ({
  mockSignOut: vi.fn(),
  state: { pathname: '/', user: null as any, isLoaded: true },
}));

vi.mock('next/navigation', () => ({
  usePathname: () => state.pathname,
}));

vi.mock('next/link', () => ({
  default: ({ children, href, onClick, ...rest }: any) => (
    <a
      href={href}
      onClick={(event: any) => {
        onClick?.(event);
        event.preventDefault();
      }}
      {...rest}
    >
      {children}
    </a>
  ),
}));

vi.mock('@clerk/nextjs', () => ({
  useUser: () => ({ user: state.user, isLoaded: state.isLoaded }),
  useClerk: () => ({ signOut: mockSignOut }),
}));

import { AdminShell } from './admin-shell';

const renderShell = () =>
  render(
    <AdminShell>
      <div>page content</div>
    </AdminShell>,
  );

describe('AdminShell', () => {
  beforeEach(() => {
    state.pathname = '/';
    state.user = null;
    state.isLoaded = true;
    mockSignOut.mockReset();
  });

  it('renders the navigation groups', () => {
    renderShell();

    expect(screen.getByText('page content')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Dashboard/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Organizations/ })).toBeInTheDocument();
    expect(screen.getByText('Control Center')).toBeInTheDocument();
  });

  it('marks the current route as active', () => {
    state.pathname = '/accounts';
    renderShell();

    expect(screen.getByRole('link', { name: /Organizations/ })).toHaveClass('bg-brand-600');
    expect(screen.getByRole('link', { name: /Dashboard/ })).not.toHaveClass('bg-brand-600');
  });

  it('skips the shell entirely on auth pages', () => {
    state.pathname = '/sign-in';
    renderShell();

    expect(screen.getByText('page content')).toBeInTheDocument();
    expect(screen.queryByText('Control Center')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Dashboard/ })).not.toBeInTheDocument();
  });

  it('opens and closes the mobile navigation drawer', () => {
    renderShell();

    expect(screen.getAllByRole('link', { name: /Organizations/ })).toHaveLength(1);

    fireEvent.click(screen.getByLabelText('Toggle Navigation'));
    expect(screen.getAllByRole('link', { name: /Organizations/ })).toHaveLength(2);

    // Clicking a link inside the drawer closes it.
    fireEvent.click(screen.getAllByRole('link', { name: /Organizations/ })[1]);
    expect(screen.getAllByRole('link', { name: /Organizations/ })).toHaveLength(1);
  });

  it('shows the signed-in admin and signs out on click', () => {
    state.user = { fullName: 'Admin Jane', primaryEmailAddress: { emailAddress: 'jane@x.com' } };
    renderShell();

    expect(screen.getByText('Admin Jane')).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Sign out of Admin Panel'));
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('falls back to the email when no full name is set', () => {
    state.user = { fullName: null, primaryEmailAddress: { emailAddress: 'jane@x.com' } };
    renderShell();

    expect(screen.getByText('jane@x.com')).toBeInTheDocument();
  });

  it('updates the global search input', () => {
    renderShell();

    const input = screen.getByPlaceholderText(/Search organizations/);
    fireEvent.change(input, { target: { value: 'acme' } });

    expect(input).toHaveValue('acme');
  });
});
