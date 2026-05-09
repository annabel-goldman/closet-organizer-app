import { DependencyList, useEffect, useState } from "react";

interface UsePageDataOptions<T> {
  deps: DependencyList;
  enabled?: boolean;
  getErrorMessage: (error: unknown) => string;
  initialData: T;
  load: (signal: AbortSignal) => Promise<T>;
  shouldUseInitialData?: boolean;
}

export function usePageData<T>({
  deps,
  enabled = true,
  getErrorMessage,
  initialData,
  load,
  shouldUseInitialData = false,
}: UsePageDataOptions<T>) {
  const [data, setData] = useState<T>(initialData);
  const [isLoading, setIsLoading] = useState(enabled && !shouldUseInitialData);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    if (!enabled || shouldUseInitialData) {
      setData(initialData);
      setErrorMessage("");
      setIsLoading(false);
      return () => controller.abort();
    }

    setIsLoading(true);
    setErrorMessage("");

    void (async () => {
      try {
        const nextData = await load(controller.signal);
        setData(nextData);
      } catch (error) {
        if (!controller.signal.aborted) {
          setErrorMessage(getErrorMessage(error));
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    })();

    return () => controller.abort();
  }, deps);

  return {
    data,
    errorMessage,
    isLoading,
    setData,
    setErrorMessage,
  };
}
