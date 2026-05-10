export const ANSAN_LOCATIONS = [
  { label: '중앙동', latitude: 37.3219, longitude: 126.8309 },
  { label: '고잔동', latitude: 37.3187, longitude: 126.8295 },
  { label: '호수동', latitude: 37.3047, longitude: 126.8236 },
  { label: '초지동', latitude: 37.3065, longitude: 126.8134 },
  { label: '선부동', latitude: 37.3345, longitude: 126.8096 },
  { label: '와동', latitude: 37.3401, longitude: 126.8253 },
  { label: '월피동', latitude: 37.3341, longitude: 126.8427 },
  { label: '성포동', latitude: 37.3229, longitude: 126.8486 },
  { label: '부곡동', latitude: 37.3329, longitude: 126.8618 },
  { label: '일동', latitude: 37.3092, longitude: 126.8695 },
  { label: '이동', latitude: 37.3053, longitude: 126.8567 },
  { label: '사동', latitude: 37.2919, longitude: 126.8524 },
  { label: '본오동', latitude: 37.2868, longitude: 126.8646 },
  { label: '상록수', latitude: 37.3028, longitude: 126.8665 },
  { label: '반월동', latitude: 37.3122, longitude: 126.9038 },
  { label: '대부동', latitude: 37.2425, longitude: 126.5842 },
];

export function findAnsanLocation(value?: string | null) {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }
  return ANSAN_LOCATIONS.find((location) => normalized.includes(location.label)) ?? null;
}
