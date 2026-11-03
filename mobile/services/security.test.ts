import { decrypt, encrypt } from './security';

describe('encrypt/decrypt', () => {
  it('faz roundtrip do payload original', () => {
    const token = encrypt({ user: 'a@b.com', pass: '123456' });
    const decoded = decrypt(token);
    expect(decoded).toMatchObject({ user: 'a@b.com', pass: '123456' });
  });

  it('inclui iat e exp no payload', () => {
    const token = encrypt({ foo: 'bar' }, 60);
    const decoded = decrypt(token);
    expect(decoded.exp - decoded.iat).toBe(60);
  });

  it('gera base64url sem padding nem separadores', () => {
    const token = encrypt({ user: 'a@b.com' });
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('rejeita payload expirado', () => {
    const token = encrypt({ user: 'a@b.com' }, -10);
    expect(decrypt(token)).toBeNull();
  });

  it('retorna null para lixo nao decodificavel', () => {
    expect(decrypt('nao.e.um.payload')).toBeNull();
    expect(decrypt('%%%')).toBeNull();
  });
});
