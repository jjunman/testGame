export const theme = {
  colors: {
    background: '#f6f7f9',
    backgroundAlt: '#eceff3',
    surface: '#ffffff',
    surfaceMuted: '#f1f3f6',
    primary: '#7467e8',
    primaryDark: '#4f46a5',
    primarySoft: '#efedff',
    accent: '#0f766e',
    accentSoft: '#def7f3',
    text: '#17191f',
    textMuted: '#69717f',
    border: '#e1e4e9',
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
  typography: {
    pageTitle: 26,
    sectionTitle: 19,
    body: 16,
    caption: 14,
  },
  shadow: {
    card: {
      shadowColor: '#111827',
      shadowOpacity: 0.05,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 1,
    },
    floating: {
      shadowColor: '#111827',
      shadowOpacity: 0.1,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 4,
    },
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
