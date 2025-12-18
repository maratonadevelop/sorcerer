export type Language = 'pt' | 'en' | 'es';

export interface Translations {
  [key: string]: string;
}

const pt: Translations = {
  home: 'Início',
  chapters: 'Capítulos',
  characters: 'Personagens',
  world: 'Mundo',
  blog: 'Blog',

  // Hero
  heroTitle: 'O Retorno do Primeiro Feiticeiro',
  heroSubtitle: 'Entre em um mundo onde a magia antiga desperta.',
  startReading: 'Começar a Ler',
  exploreWorld: 'Explorar o Mundo',

  // Home / Sections
  latestChapters: 'Últimos Capítulos',
  followEpicJourney: 'Siga a jornada épica do protagonista através de capítulos emocionantes.',
  viewAllChapters: 'Ver Todos os Capítulos',

  characterGallery: 'Galeria de Personagens',
  characterGalleryDesc: 'Conheça heróis, vilões e figuras secundárias do mundo.',
  meetHeroesVillains: 'Conheça os heróis e vilões que moldam o destino dos reinos.',
  viewCharacterProfiles: 'Ver Perfis de Personagens',

  exploreRealms: 'Explorar Reinos',
  discoverVastWorld: 'Descubra um mundo vasto e repleto de locais lendários.',

  theCodex: 'O Códex',
  codex: 'Códex',
  comprehensiveGuide: 'Um guia completo para o sistema de magia, criaturas e locais.',

  // Time labels
  oneDayAgo: '1 dia atrás',
  daysAgo: 'dias atrás',
  oneWeekAgo: '1 semana atrás',
  twoWeeksAgo: '2 semanas atrás',
  threeWeeksAgo: '3 semanas atrás',
  // Chapter card labels
  chapterLabel: 'Capítulo',
  minRead: 'min',

  // Chapters page
  allChapters: 'Todos os Capítulos',
  allChaptersDesc: 'A lista completa de capítulos publicados.',
  searchChapters: 'Pesquisar capítulos...',
  noChapters: 'Nenhum capítulo disponível ainda.',
  noChaptersFound: 'Nenhum capítulo encontrado para sua busca.',
  adjustSearchTerms: 'Tente ajustar seus termos de busca.',
  chaptersWillAppear: 'Os capítulos aparecerão aqui conforme forem publicados.',

  // Characters
  searchCharacters: 'Pesquisar personagens...',
  noCharacters: 'Nenhum personagem encontrado.',
  adjustFilters: 'Ajuste os filtros e tente novamente.',

  // Codex
  magicSystems: 'Sistemas de Magia',
  elementalMagic: 'Magia Elemental',
  elementalMagicDesc: 'Controle dos elementos naturais.',
  shadowWeaving: 'Tecelagem das Sombras',
  shadowWeavingDesc: 'Magia que manipula sombras e essência.',
  divineChanneling: 'Canalização Divina',
  divineChannelingDesc: 'Poderes concedidos por entidades divinas.',
  creaturesBeasts: 'Criaturas e Bestas',
  skyfireDragons: 'Dragões Fogo do Céu',
  skyfireDragonsDesc: 'Dragões que dominam chamas etéreas.',
  shadowWraiths: 'Espectros Sombrio',
  shadowWraithsDesc: 'Entidades formadas pela escuridão.',
  crystalSprites: 'Fadas de Cristal',
  crystalSpritesDesc: 'Pequenas criaturas de cristal luminoso.',
  legendaryLocations: 'Locais Lendários',
  sunspireTower: 'Torre do Sol',
  sunspireTowerDesc: 'Uma torre que toca os céus.',
  nethermoorCaverns: 'Cavernas de Nethermoor',
  nethermoorCavernsDesc: 'Cavernas profundas cheias de mistério.',
  eternalForge: 'Forja Eterna',
  eternalForgeDesc: 'Forja onde artefatos eternos são forjados.',

  // Blog
  authorsChronicles: 'Crônicas do Autor',
  behindScenesInsights: 'Bastidores e insights do autor',
  blogTitle: 'Crônicas do Autor',
  blogDesc: 'Insights dos bastidores e atualizações do autor',
  searchBlog: 'Pesquisar no blog...',
  all: 'Todos',
  protagonist: 'Protagonista',
  antagonist: 'Antagonista',
  supporting: 'Coadjuvante',
  behindScenes: 'Bastidores',
  noBlogPostsFound: 'Nenhuma postagem encontrada.',
  noBlogPosts: 'Ainda não há postagens no blog.',

  // Footer / UI
  footerDesc: 'Um mundo de fantasia criado pelo autor.',
  quickLinks: 'Links Rápidos',
  support: 'Suporte',
  copyright: '© 2025 O Retorno do Primeiro Feiticeiro. Todos os direitos reservados.',
  readMore: 'Ler mais',
  title: 'Título',
  published: 'Publicado',
  previous: 'Anterior',
  next: 'Próximo',
  backToChapters: 'Voltar aos capítulos',
  bookmark: 'Favoritar',
  settings: 'Configurações',
  chapterNotFound: 'Capítulo não encontrado',
  chapterNotFoundDesc: 'O capítulo que você procura não existe ou foi movido.',
  blogWillAppear: 'As postagens do blog aparecerão aqui em breve.',
  admin: 'Admin',
  adminPanel: 'Painel de Admin',
  addNew: 'Adicionar Novo',
  edit: 'Editar',
  delete: 'Excluir',
  save: 'Salvar',
  cancel: 'Cancelar',
  // Newsletter
  joinTheJourney: 'Junte-se à jornada',
  joinTheJourneyDesc: 'Assine para receber notificações quando novos capítulos forem publicados e conteúdo exclusivo dos bastidores.',
  enterYourEmail: 'Digite seu e-mail',
  subscribe: 'Inscrever-se',
  subscribing: 'Inscrevendo...',
  noSpam: 'Sem spam, apenas conteúdo épico de fantasia.',
};

const en: Translations = {
  home: 'Home',
  chapters: 'Chapters',
  characters: 'Characters',
  world: 'World',
  blog: 'Blog',

  // Hero
  heroTitle: 'The Return of the First Sorcerer',
  heroSubtitle: 'Enter a world where ancient magic awakens.',
  startReading: 'Start Reading',
  exploreWorld: 'Explore the World',

  // Home / Sections
  latestChapters: 'Latest Chapters',
  followEpicJourney: 'Follow the epic journey of the protagonist through thrilling chapters.',
  viewAllChapters: 'View All Chapters',

  characterGallery: 'Character Gallery',
  characterGalleryDesc: 'Meet the heroes, villains and supporting cast of the world.',
  meetHeroesVillains: 'Meet the heroes and villains who shape the destiny of the realms.',
  viewCharacterProfiles: 'View Character Profiles',

  exploreRealms: 'Explore Realms',
  discoverVastWorld: 'Discover a vast world filled with legendary locations.',

  theCodex: 'The Codex',
  codex: 'Codex',
  comprehensiveGuide: 'A comprehensive guide to magic systems, creatures, and locations.',

  // Time labels
  oneDayAgo: '1 day ago',
  daysAgo: 'days ago',
  oneWeekAgo: '1 week ago',
  twoWeeksAgo: '2 weeks ago',
  threeWeeksAgo: '3 weeks ago',
  // Chapter card labels
  chapterLabel: 'Chapter',
  minRead: 'min read',

  // Chapters page
  allChapters: 'All Chapters',
  allChaptersDesc: 'The complete list of published chapters.',
  searchChapters: 'Search chapters...',
  noChapters: 'No chapters available yet.',
  noChaptersFound: 'No chapters found for your search.',
  adjustSearchTerms: 'Try adjusting your search terms.',
  chaptersWillAppear: 'Chapters will appear here as they are published.',

  // Characters
  searchCharacters: 'Search characters...',
  noCharacters: 'No characters found.',
  adjustFilters: 'Adjust filters and try again.',

  // Codex
  magicSystems: 'Magic Systems',
  elementalMagic: 'Elemental Magic',
  elementalMagicDesc: 'Command over the natural elements.',
  shadowWeaving: 'Shadow Weaving',
  shadowWeavingDesc: 'Magic that manipulates shadows and essence.',
  divineChanneling: 'Divine Channeling',
  divineChannelingDesc: 'Powers granted by divine entities.',
  creaturesBeasts: 'Creatures & Beasts',
  skyfireDragons: 'Skyfire Dragons',
  skyfireDragonsDesc: 'Dragons that wield ethereal flames.',
  shadowWraiths: 'Shadow Wraiths',
  shadowWraithsDesc: 'Entities formed from darkness.',
  crystalSprites: 'Crystal Sprites',
  crystalSpritesDesc: 'Tiny creatures of luminous crystal.',
  legendaryLocations: 'Legendary Locations',
  sunspireTower: 'Sunspire Tower',
  sunspireTowerDesc: 'A tower that reaches the heavens.',
  nethermoorCaverns: 'Nethermoor Caverns',
  nethermoorCavernsDesc: 'Deep caverns filled with mystery.',
  eternalForge: 'Eternal Forge',
  eternalForgeDesc: 'A forge where eternal artifacts are wrought.',

  // Blog
  authorsChronicles: 'Author Chronicles',
  behindScenesInsights: 'Behind-the-scenes and author insights',
  blogTitle: 'Author Chronicles',
  blogDesc: 'Behind-the-scenes and author updates',
  searchBlog: 'Search the blog...',
  all: 'All',
  protagonist: 'Protagonist',
  antagonist: 'Antagonist',
  supporting: 'Supporting',
  behindScenes: 'Behind Scenes',
  noBlogPostsFound: 'No posts found.',
  noBlogPosts: 'There are no blog posts yet.',

  // Footer / UI
  footerDesc: 'A fantasy world crafted by the author.',
  quickLinks: 'Quick Links',
  support: 'Support',
  copyright: '© 2025 The Return of the First Sorcerer. All rights reserved.',
  readMore: 'Read more',
  chapterNotFound: 'Chapter Not Found',
  chapterNotFoundDesc: 'The chapter you are looking for does not exist or has been moved.',
  blogWillAppear: 'Blog posts will appear here soon.',
  admin: 'Admin',
  adminPanel: 'Admin Panel',
  addNew: 'Add New',
  edit: 'Edit',
  delete: 'Delete',
  save: 'Save',
  cancel: 'Cancel',
  // Newsletter
  joinTheJourney: 'Join the Journey',
  joinTheJourneyDesc: 'Subscribe to receive notifications when new chapters are published and exclusive behind-the-scenes content.',
  enterYourEmail: 'Enter your email',
  subscribe: 'Subscribe',
  subscribing: 'Subscribing...',
  noSpam: 'No spam, just epic fantasy content.',
};

const es: Translations = {
  home: 'Inicio',
  chapters: 'Capítulos',
  characters: 'Personajes',
  world: 'Mundo',
  blog: 'Blog',

  // Hero
  heroTitle: 'El Retorno del Primer Hechicero',
  heroSubtitle: 'Entra en un mundo donde la magia antigua despierta.',
  startReading: 'Comenzar a leer',
  exploreWorld: 'Explorar el Mundo',

  // Home / Sections
  latestChapters: 'Últimos Capítulos',
  followEpicJourney: 'Sigue la épica travesía del protagonista a través de capítulos emocionantes.',
  viewAllChapters: 'Ver Todos os Capítulos',

  characterGallery: 'Galería de Personajes',
  characterGalleryDesc: 'Conoce a héroes, villanos y personajes secundarios del mundo.',
  meetHeroesVillains: 'Conoce a los héroes y villanos que dan forma al destino de los reinos.',
  viewCharacterProfiles: 'Ver Perfiles de Personajes',

  exploreRealms: 'Explorar Reinos',
  discoverVastWorld: 'Descubre un vasto mundo lleno de lugares legendarios.',

  theCodex: 'El Códex',
  codex: 'Códex',
  comprehensiveGuide: 'Una guía completa de sistemas de magia, criaturas y lugares.',

  // Time labels
  oneDayAgo: '1 día atrás',
  daysAgo: 'días atrás',
  oneWeekAgo: '1 semana atrás',
  twoWeeksAgo: '2 semanas atrás',
  threeWeeksAgo: '3 semanas atrás',
  // Chapter card labels
  chapterLabel: 'Capítulo',
  minRead: 'min',

  // Chapters page
  allChapters: 'Todos los Capítulos',
  allChaptersDesc: 'La lista completa de capítulos publicados.',
  searchChapters: 'Buscar capítulos...',
  noChapters: 'Aún no hay capítulos disponíveis.',
  noChaptersFound: 'No se encontraron capítulos para su búsqueda.',
  adjustSearchTerms: 'Intenta ajustar tus termos de busca.',
  chaptersWillAppear: 'Los capítulos aparecerán aquí a medida que se publiquen.',

  // Characters
  searchCharacters: 'Buscar personajes...',
  noCharacters: 'No se encontraron personajes.',
  adjustFilters: 'Ajusta los filtros e intenta de nuevo.',

  // Codex
  magicSystems: 'Sistemas de Magia',
  elementalMagic: 'Magia Elemental',
  elementalMagicDesc: 'Dominio sobre los elementos naturais.',
  shadowWeaving: 'Trenzado de Sombras',
  shadowWeavingDesc: 'Magia que manipula sombras e essência.',
  divineChanneling: 'Canalização Divina',
  divineChannelingDesc: 'Poderes concedidos por entidades divinas.',
  creaturesBeasts: 'Criaturas y Bestias',
  skyfireDragons: 'Dragones de Fuego Celeste',
  skyfireDragonsDesc: 'Dragones que dominam llamas etéreas.',
  shadowWraiths: 'Espectros Sombríos',
  shadowWraithsDesc: 'Entidades formadas por la oscuridad.',
  crystalSprites: 'Duendecillos de Cristal',
  crystalSpritesDesc: 'Pequeñas criaturas de cristal luminoso.',
  legendaryLocations: 'Lugares Legendarios',
  sunspireTower: 'Torre del Sol',
  sunspireTowerDesc: 'Una torre que toca los cielos.',
  nethermoorCaverns: 'Cavernas de Nethermoor',
  nethermoorCavernsDesc: 'Cavernas profundas llenas de mistério.',
  eternalForge: 'Forja Eterna',
  eternalForgeDesc: 'Forja onde se forjam artefatos eternos.',

  // Blog
  authorsChronicles: 'Crónicas del Autor',
  behindScenesInsights: 'Detrás de cámaras y perspectivas del autor',
  blogTitle: 'Crónicas del Autor',
  blogDesc: 'Perspectivas entre bastidores y atualizações del autor',
  searchBlog: 'Buscar en el blog...',
  all: 'Todos',
  protagonist: 'Protagonista',
  antagonist: 'Antagonista',
  supporting: 'Secundario',
  behindScenes: 'Detrás de cámaras',
  noBlogPostsFound: 'No se encontraron publicaciones.',
  noBlogPosts: 'Aún no hay publicaciones en el blog.',

  // Footer / UI
  footerDesc: 'Un mundo fantástico creado por el autor.',
  quickLinks: 'Enlaces Rápidos',
  support: 'Soporte',
  copyright: '© 2025 El Retorno del Primer Hechicero. Todos os direitos reservados.',
  readMore: 'Leer más',
  chapterNotFound: 'Capítulo no encontrado',
  chapterNotFoundDesc: 'El capítulo que buscas no existe o ha sido movido.',
  blogWillAppear: 'Las entradas del blog aparecerán aquí pronto.',
  admin: 'Admin',
  adminPanel: 'Panel de Admin',
  addNew: 'Agregar Novo',
  edit: 'Editar',
  delete: 'Eliminar',
  save: 'Guardar',
  cancel: 'Cancelar',
  // Newsletter
  joinTheJourney: 'Únete a la travesía',
  joinTheJourneyDesc: 'Suscríbete para recibir notificaciones cuando se publiquen nuevos capítulos y contenido exclusivo entre bastidores.',
  enterYourEmail: 'Introduce tu correo electrónico',
  subscribe: 'Suscribirse',
  subscribing: 'Suscribiendo...',
  noSpam: 'Sin spam, solo contenido épico de fantasía.',
};

export const translations: Record<Language, Translations> = { pt, en, es };

export function useTranslation(language: Language = 'pt'): Translations {
  return translations[language] || translations.pt;
}

