import { useState } from 'react';

export function useAsyncAction<TArgs extends unknown[]>(fn: (...args: TArgs) => Promise<void>) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (...args: TArgs) => {
    setLoading(true);
    setError(null);
    try {
      await fn(...args);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return { run, loading, error };
}
