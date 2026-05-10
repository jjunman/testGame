export type SongCatalogItem = {
  title: string;
  artist: string;
  youtubeVideoId: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  requiredInstruments: string[];
};

export const songCatalogSeed: SongCatalogItem[] = [
  {
    title: 'No Pain',
    artist: '실리카겔',
    youtubeVideoId: 'DCQRE0VKK2I',
    difficulty: 'medium',
    requiredInstruments: ['보컬', '리드기타', '베이스', '드럼'],
  },
  {
    title: '그대에게',
    artist: '신해철',
    youtubeVideoId: 'gJqCO8E63-s',
    difficulty: 'medium',
    requiredInstruments: ['보컬', '기타', '베이스', '드럼', '키보드'],
  },
  {
    title: 'Back In Black',
    artist: 'AC/DC',
    youtubeVideoId: 'pAgnJDJN4VA',
    difficulty: 'hard',
    requiredInstruments: ['보컬', '리드기타', '서브기타', '베이스', '드럼'],
  },
];
