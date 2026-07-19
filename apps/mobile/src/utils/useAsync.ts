import { useCallback, useState } from 'react';

export function useAsyncAction<TArgs extends unknown[]>(fn: (...args: TArgs) => Promise<void>) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (...args: TArgs) => {
    if (loading) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await fn(...args);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [fn, loading]);

  return { run, loading, error };
}
