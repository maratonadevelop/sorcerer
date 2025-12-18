import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import AdminPage from '@/pages/admin';
import { renderWithProviders } from '../test-utils';

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u' }, isLoading: false, isAuthenticated: true, isAdmin: true }) }));
vi.mock('@/components/rich-editor', () => ({ default: (props: any) => React.createElement('textarea', { placeholder: props?.placeholder || 'editor', value: props?.value || '', onChange: (e: any) => props?.onChange?.(e.target.value) }) }));

describe('LocationForm via AdminPage', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn(() => Promise.resolve({ ok: true, json: async () => ({ id: 'new' }) } as any)) as any;
    const qc = (globalThis as any).__TEST_QUERY_CLIENT__;
    if (qc) {
      qc.setQueryData(['/api/locations'], []);
    }
  });

  it('creates a location', async () => {
    renderWithProviders(<AdminPage />);
    const locationsTab = await screen.findByTestId('tab-locations');
    fireEvent.click(locationsTab);
    const btn = await screen.findByTestId('new-location-btn');
    fireEvent.click(btn);
    fireEvent.change(await screen.findByPlaceholderText(/Nome da localização/i), { target: { value: 'Aldeia' } });
    fireEvent.change(await screen.findByPlaceholderText(/Descrição breve da localização/i), { target: { value: 'Pitoresca' } });
    const form = (await screen.findByPlaceholderText(/Nome da localização/i)).closest('form')!;
    fireEvent.submit(form);
    await waitFor(() => {
      const calls = (globalThis.fetch as any).mock.calls as any[];
      const found = calls.some((c) => String(c[0]).includes('/api/admin/locations') && c[1]?.method === 'POST');
      expect(found).toBe(true);
    });
  });
});
