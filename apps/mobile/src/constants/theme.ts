export const theme = {
  colors: {
    background: '#f7f8fa',
    backgroundAlt: '#eef1f4',
    surface: '#ffffff',
    surfaceMuted: '#f2f4f7',
    primary: '#8b7cf6',
    primaryDark: '#5b4bc4',
    primarySoft: '#f0edff',
    accent: '#0f766e',
    accentSoft: '#def7f3',
    text: '#16181d',
    textMuted: '#68707d',
    border: '#dfe3ea',
    success: '#12805c',
    warning: '#b7791f',
    danger: '#d14343',
    shadow: 'rgba(17, 24, 39, 0.06)',
  },
  radius: {
    sm: 8,
    md: 8,
    lg: 10,
    pill: 999,
  },
  spacing: {
    xs: 6,
    sm: 10,
    md: 16,
    lg: 22,
    xl: 30,
  },
};

export const fallbackBandImage =
  'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?auto=format&fit=crop&w=1200&q=80';

export const positionOptions = [
  { value: 'lead_guitar', label: '리드기타' },
  { value: 'sub_guitar', label: '서브기타' },
  { value: 'bass', label: '베이스' },
  { value: 'drums', label: '드럼' },
  { value: 'piano', label: '피아노' },
  { value: 'vocal', label: '보컬' },
  { value: 'custom', label: '직접 입력' },
] as const;

export const difficultyLabels: Record<string, string> = {
  easy: '쉬움',
  medium: '보통',
  hard: '어려움',
};
