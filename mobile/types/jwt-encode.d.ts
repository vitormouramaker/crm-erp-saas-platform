declare module 'jwt-encode' {
  export default function sign(
    data: Record<string, unknown>,
    secret: string,
    options?: Record<string, unknown>
  ): string;
}
