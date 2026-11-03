import { useState, useEffect } from "react";

/**
 * Hook que atrasa a atualização de um valor, útil para buscas.
 * @param value O valor a ser "atrasado" (ex: o termo da busca).
 * @param delay O tempo em milissegundos (ex: 300).
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Seta um timer para atualizar o valor
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Limpa o timer se o valor mudar (ex: usuário continua digitando)
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]); // Só re-executa se o valor ou o delay mudarem

  return debouncedValue;
}
