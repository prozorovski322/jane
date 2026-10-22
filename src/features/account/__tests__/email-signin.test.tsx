import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { EmailLinkScreen, EmailSignInScreen } from '../EmailSignInScreen';
import { OAuthConsentScreen } from '../OAuthConsentScreen';

const mockSend = jest.fn(async () => ({ data: {}, error: null }));
const mockVerify = jest.fn(async () => ({ data: {}, error: null }));
const mockOAuth = jest.fn(async () => ({ data: {}, error: null }));
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  router: { replace: (...args: unknown[]) => mockReplace(...args) },
  Link: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('@/core/account/client', () => ({
  supabase: () => ({
    auth: { signInWithOtp: mockSend, verifyOtp: mockVerify, signInWithOAuth: mockOAuth },
  }),
}));
jest.mock('@/core/feedback/feedback', () => ({ feedback: { tap: jest.fn() } }));

beforeEach(() => {
  jest.clearAllMocks();
  mockSend.mockResolvedValue({ data: {}, error: null });
  mockVerify.mockResolvedValue({ data: {}, error: null });
});

describe('e-mail sign-in', () => {
  it('requests a code for an existing account, locks its address, and prevents immediate resend', async () => {
    await render(<EmailSignInScreen onBack={jest.fn()} />);
    await fireEvent.changeText(screen.getByLabelText('Почта'), ' anna@example.com ');
    await fireEvent.press(screen.getByRole('button', { name: 'Прислать код и ссылку' }));
    await screen.findByLabelText('Код из письма');
    expect(mockSend).toHaveBeenCalledWith({
      email: 'anna@example.com',
      options: expect.objectContaining({ shouldCreateUser: false }),
    });
    expect(screen.queryByLabelText('Почта')).toBeNull();
    expect(screen.getByRole('button', { name: /Отправить снова через/ })).toBeDisabled();

    await fireEvent.changeText(screen.getByLabelText('Код из письма'), '12');
    await fireEvent.press(screen.getByRole('button', { name: 'Войти по коду' }));
    expect(mockVerify).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByLabelText('Код из письма'), '12345678');
    await fireEvent.press(screen.getByRole('button', { name: 'Войти по коду' }));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
    expect(mockVerify).toHaveBeenCalledWith({
      email: 'anna@example.com',
      token: '12345678',
      type: 'email',
    });
  });

  it('does not advance after a send failure and allows retry', async () => {
    mockSend.mockRejectedValueOnce(new Error('Network unavailable'));
    await render(<EmailSignInScreen onBack={jest.fn()} />);
    await fireEvent.changeText(screen.getByLabelText('Почта'), 'anna@example.com');
    await fireEvent.press(screen.getByRole('button', { name: 'Прислать код и ссылку' }));
    await screen.findByText('Что-то пошло не так. Попробуйте ещё раз.');
    expect(screen.queryByLabelText('Код из письма')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Прислать код и ссылку' }));
    await screen.findByLabelText('Код из письма');
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it('requires a click to redeem a link so e-mail previews cannot consume it', async () => {
    const token = 'a'.repeat(56);
    await render(<EmailLinkScreen tokenHash={token} />);
    expect(mockVerify).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Войти в Jane' }));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
    expect(mockVerify).toHaveBeenCalledWith({ token_hash: token, type: 'email' });
  });

  it('keeps expired links on the confirmation screen with a useful error', async () => {
    mockVerify.mockResolvedValueOnce({
      data: {},
      error: { message: 'Token has expired or is invalid' },
    } as never);
    await render(<EmailLinkScreen tokenHash={'b'.repeat(64)} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Войти в Jane' }));
    await screen.findByText(/Код или ссылка недействительны/);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('rejects malformed links without sending a verification request', async () => {
    await render(<EmailLinkScreen tokenHash="invalid" />);
    await fireEvent.press(screen.getByRole('button', { name: 'Войти в Jane' }));
    await screen.findByText(/Ссылка недействительна/);
    expect(mockVerify).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('requires privacy consent before an external provider can create an account', async () => {
    await render(<OAuthConsentScreen provider="google" onBack={jest.fn()} />);
    expect(mockOAuth).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Продолжить' })).toBeDisabled();
    await fireEvent(screen.getByRole('switch'), 'valueChange', true);
    await fireEvent.press(screen.getByRole('button', { name: 'Продолжить' }));
    await waitFor(() => expect(mockOAuth).toHaveBeenCalledTimes(1));
    expect(mockOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: expect.objectContaining({ redirectTo: expect.any(String) }),
    });
  });
});
