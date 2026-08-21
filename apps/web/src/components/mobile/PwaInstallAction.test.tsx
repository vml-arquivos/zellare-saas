import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import PwaInstallAction from './PwaInstallAction';

function installMobileBrowserEnvironment() {
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
  Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 5 });
  Object.defineProperty(navigator, 'userAgent', {
    configurable: true,
    value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
  });
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { register: async () => undefined },
  });
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      matches: query.includes('pointer: coarse'),
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

describe('PwaInstallAction', () => {
  beforeEach(() => {
    installMobileBrowserEnvironment();
  });

  it('mantém a instrução iOS oculta até o clique do usuário', async () => {
    const user = userEvent.setup();
    render(<PwaInstallAction />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    await user.click(screen.getByTitle('Como instalar o Zelare'));

    expect(screen.getByRole('status')).toHaveTextContent('Adicionar à Tela de Início');
  });
});
