export const theme = {
  colors: {
    background: '#f7f4ff',
    backgroundAlt: '#efe9ff',
    surface: '#ffffff',
    surfaceMuted: '#f5f1ff',
    primary: '#5b3df5',
    primaryDark: '#3e28b6',
    primarySoft: '#dcd2ff',
    accent: '#ff8ea2',
    accentSoft: '#ffe0e6',
    text: '#221a44',
    textMuted: '#6f6792',
    border: '#cabfff',
    success: '#42b883',
    warning: '#ffb84d',
    danger: '#ff6b7a',
    shadow: 'rgba(78, 53, 158, 0.14)',
  },
  radius: {
    sm: 12,
    md: 18,
    lg: 28,
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
