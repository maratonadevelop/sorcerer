import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import AdminPage from '@/pages/admin';
import { renderWithProviders } from '../test-utils';

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u' }, isLoading: false, isAuthenticated: true, isAdmin: true }) }));
vi.mock('@/components/rich-editor', () => ({ default: (props: any) => React.createElement('textarea', { placeholder: props?.placeholder || 'editor', value: props?.value || '', onChange: (e: any) => props?.onChange?.(e.target.value) }) }));

describe('CodexForm via AdminPage', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn(() => Promise.resolve({ ok: true, json: async () => ({ id: 'new' }) } as any)) as any;
    // seed queries so react-query doesn't attempt a refetch that masks our POST
    const qc = (globalThis as any).__TEST_QUERY_CLIENT__;
    if (qc) {
      qc.setQueryData(['/api/codex'], []);
    }
  });

  it('creates a codex entry', async () => {
    renderWithProviders(<AdminPage />);
  const codexTab = await screen.findByTestId('tab-codex');
  fireEvent.click(codexTab);
  const btn = await screen.findByTestId('new-codex-btn');
    fireEvent.click(btn);
    fireEvent.change(await screen.findByPlaceholderText(/Título da entrada/i), { target: { value: 'Fogo' } });
    fireEvent.change(await screen.findByPlaceholderText(/Descrição breve da entrada/i), { target: { value: 'Elemento' } });
    const form = (await screen.findByPlaceholderText(/Título da entrada/i)).closest('form')!;
    fireEvent.submit(form);
    await waitFor(() => {
      const calls = (globalThis.fetch as any).mock.calls as any[];
      const found = calls.some((c) => String(c[0]).includes('/api/admin/codex') && (c[1]?.method === 'POST'));
      expect(found).toBe(true);
    });
  });
});
