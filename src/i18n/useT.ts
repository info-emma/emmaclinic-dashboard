import { useDataStore } from '../store/useDataStore';
import { translations } from './translations';

export function useT() {
  const language = useDataStore(s => s.language);
  return translations[language];
}
