import React, { createContext, useContext, useMemo, useState } from 'react';
import { BandSummary } from '@band/shared-types';

type CurrentBandContextValue = {
  currentBand: BandSummary | null;
  setCurrentBand: (band: BandSummary | null) => void;
};

const CurrentBandContext = createContext<CurrentBandContextValue | null>(null);

export function CurrentBandProvider({ children }: { children: React.ReactNode }) {
  const [currentBand, setCurrentBand] = useState<BandSummary | null>(null);

  const value = useMemo(
    () => ({
      currentBand,
      setCurrentBand,
    }),
    [currentBand],
  );

  return <CurrentBandContext.Provider value={value}>{children}</CurrentBandContext.Provider>;
}

export function useCurrentBand() {
  const context = useContext(CurrentBandContext);
  if (!context) {
    throw new Error('useCurrentBand must be used within CurrentBandProvider');
  }

  return context;
}
