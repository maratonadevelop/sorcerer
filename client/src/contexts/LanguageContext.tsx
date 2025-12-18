import React, { createContext, useContext, useEffect, ReactNode } from 'react';

// Minimal, Portuguese-only translation map kept here as the single source of truth.
// This removes the separate translations module and prevents accidental
// multilingual complexity while keeping `t` available across the app.
export type Language = 'pt';

// Allow arbitrary keys on t to avoid needing to re-declare every translation string.
// We'll keep a minimal set of Portuguese strings here and allow components to
// access other UI strings without strict type errors during the migration.
const pt: Record<string, string> = {
  home: 'Início',
  chapters: 'Capítulos',
  characters: 'Personagens',
  world: 'Mundo',
  codex: 'Codex',
  blog: 'Blog',
  heroTitle: 'O Retorno do Primeiro Feiticeiro',
  admin: 'Admin',
  addNew: 'Adicionar Novo',
  edit: 'Editar',
  delete: 'Excluir',
  save: 'Salvar',
  cancel: 'Cancelar',
  // Time labels & common UI (Portuguese-only app)
  oneDayAgo: '1 dia atrás',
  daysAgo: 'dias atrás',
  oneWeekAgo: '1 semana atrás',
  twoWeeksAgo: '2 semanas atrás',
  threeWeeksAgo: '3 semanas atrás',
  chapterLabel: 'Capítulo',
  minRead: 'min',
  published: 'Publicado',
  previous: 'Anterior',
  next: 'Próximo',
  backToChapters: 'Voltar aos capítulos',
  bookmark: 'Favoritar',
  settings: 'Configurações',
  // Chapters page essentials
  allChapters: 'Todos os Capítulos',
  allChaptersDesc: 'A lista completa de capítulos publicados.',
  searchChapters: 'Pesquisar capítulos...',
  noChapters: 'Nenhum capítulo disponível ainda.',
  noChaptersFound: 'Nenhum capítulo encontrado para sua busca.',
  adjustSearchTerms: 'Tente ajustar seus termos de busca.',
  chaptersWillAppear: 'Os capítulos aparecerão aqui conforme forem publicados.',
  // Reader fallbacks
  chapterNotFound: 'Capítulo não encontrado',
  chapterNotFoundDesc: 'O capítulo que você procura não existe ou foi movido.',
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Record<string, string>;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const language: Language = 'pt';
  const setLanguage = (_: Language) => { /* no-op: Portuguese-only app */ };

  useEffect(() => { document.documentElement.lang = language; }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t: pt }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) throw new Error('useLanguage must be used within a LanguageProvider');
  return context;
}