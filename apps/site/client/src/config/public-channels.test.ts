import { describe, expect, it } from 'vitest';
import {
  PUBLIC_CHANNEL_DEFAULTS,
  PUBLIC_CHANNELS,
  createPublicChannels,
  publicChannelMailto,
  publicChannelTel,
} from './public-channels';

describe('public institutional channels', () => {
  it('uses only valid historical public channels outside production', () => {
    expect(PUBLIC_CHANNELS).toEqual(PUBLIC_CHANNEL_DEFAULTS);
    expect(PUBLIC_CHANNELS.contactEmail).toBe('contato@zelare.com.br');
    expect(PUBLIC_CHANNELS.complianceEmail).toBe('denuncia@zelare.com.br');
    expect(PUBLIC_CHANNELS.phone).toBe('(61) 2123-4567');
    expect(PUBLIC_CHANNELS.address).toBe('Brasília-DF');
  });

  it('fails clearly when a production channel is missing', () => {
    expect(() => createPublicChannels({}, true)).toThrow(
      'VITE_PUBLIC_CONTACT_EMAIL',
    );
  });

  it('rejects invalid production channels', () => {
    expect(() =>
      createPublicChannels(
        {
          VITE_PUBLIC_CONTACT_EMAIL: 'contato@example.invalid',
          VITE_PUBLIC_COMPLIANCE_EMAIL: 'denuncia@zelare.com.br',
          VITE_PUBLIC_PHONE: '(61) 2123-4567',
          VITE_PUBLIC_ADDRESS: 'Brasília-DF',
        },
        true,
      ),
    ).toThrow('VITE_PUBLIC_CONTACT_EMAIL');

    expect(() =>
      createPublicChannels(
        {
          VITE_PUBLIC_CONTACT_EMAIL: 'contato@zelare.com.br',
          VITE_PUBLIC_COMPLIANCE_EMAIL: 'denuncia@zelare.com.br',
          VITE_PUBLIC_PHONE: '0000000000',
          VITE_PUBLIC_ADDRESS: 'Brasília-DF',
        },
        true,
      ),
    ).toThrow('VITE_PUBLIC_PHONE');
  });

  it('exposes functional mailto and tel links', () => {
    expect(publicChannelMailto(PUBLIC_CHANNELS.contactEmail)).toBe(
      'mailto:contato@zelare.com.br',
    );
    expect(publicChannelMailto(PUBLIC_CHANNELS.complianceEmail)).toBe(
      'mailto:denuncia@zelare.com.br',
    );
    expect(publicChannelTel(PUBLIC_CHANNELS.phone)).toBe('tel:+556121234567');
  });
});
