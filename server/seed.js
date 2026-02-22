import mongoose from 'mongoose';
import dns from 'dns';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Fix DNS for MongoDB Atlas SRV lookups
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

import {
  Article, Author, Category, Ad, Breaking, User,
  Wanted, Job, Court, Event, Poll, Comment, Gallery, Permission, HeroSettings, SiteSettings, ArticleRevision, SettingsRevision, ArticleView, PollVote, AuthSession,
} from './models.js';

// Import static data from frontend
import {
  articles as staticArticles,
  authors as staticAuthors,
  categories as staticCategories,
  adBanners as staticAds,
  breakingNews as staticBreaking,
} from '../src/data/articles.js';

import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

// ─── Default RP Data ───
const defaultAdminPassword = process.env.DEFAULT_ADMIN_PASSWORD
  || (process.env.NODE_ENV === 'production' ? '' : 'admin123');

if (!defaultAdminPassword) {
  throw new Error('DEFAULT_ADMIN_PASSWORD is required in production seed.');
}

if (!process.env.DEFAULT_ADMIN_PASSWORD && process.env.NODE_ENV !== 'production') {
  console.warn('⚠ DEFAULT_ADMIN_PASSWORD is not set. Using development fallback password.');
}

const DEFAULT_ADMIN = {
  id: 1,
  username: 'admin',
  password: bcrypt.hashSync(defaultAdminPassword, 10),
  name: 'Главен Администратор',
  role: 'admin',
  profession: 'Главен редактор',
  avatar: '👑',
  createdAt: '2026-01-01',
};

const DEFAULT_WANTED = [
  { id: 1, name: 'Иван "Ковача" Петков', bounty: '$50,000', charge: 'Въоръжен грабеж', danger: 'high' },
  { id: 2, name: 'Марина Стоянова', bounty: '$25,000', charge: 'Измама и пране на пари', danger: 'medium' },
  { id: 3, name: 'Деян "Сянката" Николов', bounty: '$75,000', charge: 'Убийство от първа степен', danger: 'high' },
  { id: 4, name: 'Неизвестен, маска "Вълк"', bounty: '$15,000', charge: 'Серия от обири', danger: 'medium' },
  { id: 5, name: 'Борис Златков', bounty: '$30,000', charge: 'Трафик на оръжия', danger: 'high' },
];

const DEFAULT_JOBS = [
  { id: 1, title: 'Полицай — Патрулен отдел', org: 'ЗУПД', type: 'police', description: 'Търсим мотивирани кадети за патрулната служба.', requirements: 'Чисто досие, шофьорска книжка, 18+ години', salary: '$3,500/мес', contact: 'Комисариат — ул. Централна 1', date: '2026-02-08', active: true },
  { id: 2, title: 'Парамедик — EMS Los Santos', org: 'EMS', type: 'ems', description: 'Спешна медицинска служба търси парамедици на пълен работен ден.', requirements: 'Медицинско образование, стресоустойчивост', salary: '$3,000/мес', contact: 'EMS база — бул. Здраве 15', date: '2026-02-07', active: true },
  { id: 3, title: 'Механик — Los Santos Auto House', org: 'Los Santos Auto House', type: 'mechanic', description: 'Нуждаем се от опитен автомеханик.', requirements: '2+ години опит, познания по тунинг', salary: '$2,800/мес', contact: 'Автосервиз — Индустриална зона', date: '2026-02-06', active: true },
  { id: 4, title: 'Адвокат — АК "Los Santosски"', org: 'АК Los Santosски', type: 'lawyer', description: 'Търсим асоцииран адвокат за наказателно право.', requirements: 'Юридическо образование, адвокатска правоспособност', salary: '$5,000/мес', contact: 'бул. Свободата 22, ет. 3', date: '2026-02-05', active: true },
  { id: 5, title: 'Таксиметров шофьор', org: 'Los Santos Taxi', type: 'driver', description: 'Набираме шофьори за дневна и нощна смяна.', requirements: 'Категория B, познаване на града', salary: '$2,200/мес + бакшиши', contact: 'Таксиметров парк — кв. Център', date: '2026-02-04', active: true },
];

const DEFAULT_COURT = [
  { id: 1, title: 'Дело срещу "Ковача" за въоръжен грабеж', defendant: 'Иван Петков', charge: 'Въоръжен грабеж на бензиностанция', verdict: 'Задочно — 15 години затвор', judge: 'Съдия Радев', date: '2026-02-06', details: 'Подсъдимият е в бягство. Присъдата е произнесена задочно.', severity: 'heavy', status: 'completed' },
  { id: 2, title: 'Процес за пране на пари — Стоянова', defendant: 'Марина Стоянова', charge: 'Пране на пари чрез фиктивни фирми', verdict: '', judge: 'Съдия Петрова', date: '2026-02-04', details: 'Прокуратурата представи доказателства за 12 фиктивни фирми.', severity: 'heavy', status: 'scheduled', nextHearing: '2026-02-15' },
  { id: 3, title: 'Хулиганство пред Club Neon', defendant: 'Стефан Маринов', charge: 'Хулиганство и лека телесна повреда', verdict: '6 месеца условно + глоба $2,000', judge: 'Съдия Димов', date: '2026-02-03', details: 'Инцидентът от 18 януари пред нощен клуб.', severity: 'light', status: 'completed' },
  { id: 4, title: 'Нелегално притежание на оръжие', defendant: 'Георги Тодоров', charge: 'Притежание на незаконно огнестрелно оръжие', verdict: '2 години затвор', judge: 'Съдия Радев', date: '2026-02-01', details: 'При обиск бяха открити 2 пистолета и боеприпаси без разрешително.', severity: 'medium', status: 'completed' },
  { id: 5, title: 'Дело за трафик на наркотици', defendant: 'Красимир Влахов', charge: 'Разпространение на контролирани вещества', verdict: '', judge: 'Съдия Петрова', date: '2026-02-08', details: 'Задържан при акция на ЗУПД с 2 кг марихуана.', severity: 'heavy', status: 'scheduled', nextHearing: '2026-02-20' },
  { id: 6, title: 'Измама с имоти — група от 4 лица', defendant: 'Николай Генчев и др.', charge: 'Документна измама и присвояване', verdict: '', judge: 'Съдия Димов', date: '2026-02-09', details: 'Обвиняемите са фалшифицирали нотариални актове за 3 имота.', severity: 'medium', status: 'ongoing', nextHearing: '2026-02-18' },
];

const DEFAULT_EVENTS = [
  { id: 1, title: 'Ралито на Los Santos 2026', description: 'Годишното автомобилно рали из улиците на Los Santos!', date: '2026-02-15', time: '14:00', location: 'Старт: Площад Република', organizer: 'Los Santos Racing Club', type: 'race', image: '🏎️' },
  { id: 2, title: 'Благотворителен бал — Кметство', description: 'Официален бал в полза на детския дом "Надежда".', date: '2026-02-14', time: '20:00', location: 'Кметството — Голяма зала', organizer: 'Община Los Santos', type: 'party', image: '🎭' },
  { id: 3, title: 'Бокс турнир — "Железен юмрук"', description: 'Аматьорски боксов турнир с награден фонд $10,000.', date: '2026-02-20', time: '19:00', location: 'FitZone Gym', organizer: 'FitZone', type: 'tournament', image: '🥊' },
  { id: 4, title: 'Обществено събрание — кв. Южен парк', description: 'Дискусия за сигурността в квартала.', date: '2026-02-12', time: '18:00', location: 'Читалище "Южен парк"', organizer: 'Кварталният съвет', type: 'meeting', image: '🏛️' },
];

const DEFAULT_POLLS = [
  { id: 1, question: 'Чувствате ли се сигурни в Los Santos?', options: [{ text: 'Да, напълно', votes: 45 }, { text: 'Донякъде', votes: 128 }, { text: 'Не, изобщо', votes: 89 }], active: true, createdAt: '2026-02-06' },
  { id: 2, question: 'Одобрявате ли проекта за летище?', options: [{ text: 'Да', votes: 210 }, { text: 'Не', votes: 95 }, { text: 'Нямам мнение', votes: 55 }], active: false, createdAt: '2026-02-01' },
];

const DEFAULT_COMMENTS = [
  { id: 1, articleId: 1, author: 'Георги П.', avatar: '👤', text: 'Страхотна статия! Благодаря за информацията.', date: '2026-02-07', approved: true },
  { id: 2, articleId: 1, author: 'Мария К.', avatar: '👩', text: 'Интересна гледна точка, продължавайте така!', date: '2026-02-08', approved: true },
  { id: 3, articleId: 2, author: 'Стефан Д.', avatar: '🧑', text: 'Има ли повече подробности по случая?', date: '2026-02-07', approved: true },
  { id: 4, articleId: 3, author: 'Анонимен', avatar: '🕵️', text: 'Ситуацията е тревожна...', date: '2026-02-06', approved: false },
];

const DEFAULT_GALLERY = [
  { id: 1, title: 'Преследване в центъра', description: 'Полицейско преследване по бул. Централен', image: 'https://images.unsplash.com/photo-1553708881-112abc53fe54?w=800', category: 'crime', date: '2026-02-08', featured: true },
  { id: 2, title: 'Ралито на Los Santos 2026', description: 'Моменти от годишното рали', image: 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800', category: 'events', date: '2026-02-07', featured: true },
  { id: 3, title: 'Пожар в Индустриалната зона', description: 'EMS и пожарна при ликвидиране на пожар', image: 'https://images.unsplash.com/photo-1486551937199-baf066858de7?w=800', category: 'emergency', date: '2026-02-06', featured: false },
  { id: 4, title: 'Бал в Кметството', description: 'Благотворителният бал събра над 200 гости', image: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800', category: 'society', date: '2026-02-05', featured: true },
  { id: 5, title: 'Арест на площада', description: 'ЗУПД задържа заподозрян в кражба', image: 'https://images.unsplash.com/photo-1589578527966-fdac0f44566c?w=800', category: 'crime', date: '2026-02-04', featured: false },
  { id: 6, title: 'Нощен Los Santos', description: 'Градският пейзаж след залез', image: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=800', category: 'reportage', date: '2026-02-03', featured: true },
];

const DEFAULT_PERMISSIONS = [
  { role: 'admin', permissions: { articles: true, categories: true, ads: true, breaking: true, wanted: true, jobs: true, court: true, events: true, polls: true, comments: true, contact: true, gallery: true, profiles: true, permissions: true } },
  { role: 'editor', permissions: { articles: true, categories: true, ads: true, breaking: true, wanted: false, jobs: false, court: false, events: true, polls: true, comments: true, contact: true, gallery: true, profiles: false, permissions: false } },
  { role: 'reporter', permissions: { articles: true, categories: false, ads: false, breaking: false, wanted: false, jobs: false, court: false, events: false, polls: false, comments: false, contact: false, gallery: true, profiles: false, permissions: false } },
  { role: 'photographer', permissions: { articles: false, categories: false, ads: false, breaking: false, wanted: false, jobs: false, court: false, events: false, polls: false, comments: false, contact: false, gallery: true, profiles: false, permissions: false } },
  { role: 'intern', permissions: { articles: false, categories: false, ads: false, breaking: false, wanted: false, jobs: false, court: false, events: false, polls: false, comments: false, contact: false, gallery: false, profiles: false, permissions: false } },
];

const DEFAULT_HERO_SETTINGS = {
  key: 'main',
  headline: 'ТАЙНИ СРЕЩИ НА ПЛАЖА\nИ ПАРКА!',
  shockLabel: 'ШОК!',
  ctaLabel: 'РАЗКРИЙ ВСИЧКО ТУК!',
  headlineBoardText: 'ШОК И СЕНЗАЦИЯ!',
  captions: ['В КОЛАТА НА ПОЛИЦАЯ!', 'ГОРЕЩА ПРЕГРЪДКА!', 'ТАЙНА СРЕЩА В ПАРКА!'],
  mainPhotoArticleId: null,
  photoArticleIds: [],
};

const DEFAULT_SITE_SETTINGS = {
  key: 'main',
  breakingBadgeLabel: 'ГОРЕЩО!',
  navbarLinks: [
    { to: '/', label: 'Начало' },
    { to: '/category/crime', label: 'Криминални', hot: true },
    { to: '/category/underground', label: 'Подземен свят', hot: true },
    { to: '/category/emergency', label: 'Полиция' },
    { to: '/category/breaking', label: 'Извънредни', hot: true },
    { to: '/category/reportage', label: 'Репортажи' },
    { to: '/category/politics', label: 'Политика' },
    { to: '/category/business', label: 'Бизнес' },
    { to: '/category/society', label: 'Общество' },
    { to: '/tipline', label: 'Сигнали', hot: true },
    { to: '/jobs', label: 'Работа' },
    { to: '/court', label: 'Съд' },
    { to: '/events', label: 'Събития' },
    { to: '/gallery', label: 'Галерия' },
  ],
  spotlightLinks: [
    { to: '/category/crime', label: 'Горещо', icon: 'Flame', hot: true, tilt: '-2deg' },
    { to: '/category/underground', label: 'Скандали', icon: 'Megaphone', hot: true, tilt: '1.5deg' },
    { to: '/category/society', label: 'Слухове', icon: 'Bell', hot: false, tilt: '-1deg' },
  ],
  footerPills: [
    { label: 'Горещо', to: '/category/crime', hot: true, tilt: '-1.5deg' },
    { label: 'Скандали', to: '/category/underground', hot: true, tilt: '1deg' },
    { label: 'Слухове', to: '/category/society', hot: false, tilt: '-0.8deg' },
    { label: 'Криминални', to: '/category/crime', hot: false, tilt: '0.8deg' },
    { label: 'Бизнес', to: '/category/business', hot: false, tilt: '-1deg' },
  ],
  footerQuickLinks: [
    { label: 'Криминални', to: '/category/crime' },
    { label: 'Подземен свят', to: '/category/underground' },
    { label: 'Полиция', to: '/category/emergency' },
    { label: 'Извънредни', to: '/category/breaking' },
    { label: 'Политика', to: '/category/politics' },
    { label: 'Бизнес', to: '/category/business' },
    { label: 'Общество', to: '/category/society' },
  ],
  footerInfoLinks: [
    { label: 'За нас', to: '/about' },
    { label: 'Работа', to: '/jobs' },
    { label: 'Съдебна хроника', to: '/court' },
    { label: 'Събития', to: '/events' },
    { label: 'Галерия', to: '/gallery' },
  ],
  contact: {
    address: 'Vinewood Blvd 42, Los Santos',
    phone: '+381 11 123 4567',
    email: 'redakciq@znews.live',
  },
  about: {
    heroText: 'Независим новинарски портал за града Los Santos. Доставяме ви новини, репортажи и разследвания 24 часа в денонощието, 7 дни в седмицата.',
    missionTitle: 'Нашата мисия',
    missionParagraph1: 'zNews е създаден с целта да предостави на гражданите на Los Santos честна, навременна и безпристрастна информация за случващото се в града. Ние вярваме в силата на журналистиката да информира, образова и вдъхновява промяна.',
    missionParagraph2: 'Нашият екип от опитни журналисти работи денонощно, за да покрива всички аспекти на живота в Los Santos — от криминалните хроники до обществените събития, от бизнес новините до спортните триумфи.',
    adIntro: 'Искаш да рекламираш своя бизнес в Los Santos? zNews предлага разнообразни рекламни формати:',
    adPlans: [
      { name: 'Банер (горен)', price: '$500/месец', desc: 'Хоризонтален банер в горната част' },
      { name: 'Банер (страничен)', price: '$300/месец', desc: 'Странично каре в sidebar' },
      { name: 'Банер (в статия)', price: '$400/месец', desc: 'Вграден в съдържанието' },
    ],
  },
  layoutPresets: {
    homeFeatured: 'default',
    homeCrime: 'default',
    homeReportage: 'default',
    homeEmergency: 'default',
    articleRelated: 'default',
    categoryListing: 'default',
    searchListing: 'default',
  },
  tipLinePromo: {
    enabled: true,
    title: 'Имаш ли новина за нас?',
    description: 'Стана ли свидетел на нещо скандално, незаконно или просто интересно? Прати ни ексклузивен сигнал и снимки напълно анонимно!',
    buttonLabel: 'ПОДАЙ СИГНАЛ',
    buttonLink: '/tipline',
  },
};

// ─── Seed Function ───
export async function seedAll() {
  console.log('Seeding database...');

  await Promise.all([
    Article.deleteMany({}),
    Author.deleteMany({}),
    Category.deleteMany({}),
    Ad.deleteMany({}),
    Breaking.deleteMany({}),
    User.deleteMany({}),
    Wanted.deleteMany({}),
    Job.deleteMany({}),
    Court.deleteMany({}),
    Event.deleteMany({}),
    Poll.deleteMany({}),
    Comment.deleteMany({}),
    Gallery.deleteMany({}),
    Permission.deleteMany({}),
    HeroSettings.deleteMany({}),
    SiteSettings.deleteMany({}),
    ArticleRevision.deleteMany({}),
    SettingsRevision.deleteMany({}),
    ArticleView.deleteMany({}),
    PollVote.deleteMany({}),
    AuthSession.deleteMany({}),
  ]);

  await Promise.all([
    Article.insertMany(staticArticles),
    Author.insertMany(staticAuthors),
    Category.insertMany(staticCategories),
    Ad.insertMany(staticAds),
    Breaking.create({ items: staticBreaking }),
    User.create(DEFAULT_ADMIN),
    Wanted.insertMany(DEFAULT_WANTED),
    Job.insertMany(DEFAULT_JOBS),
    Court.insertMany(DEFAULT_COURT),
    Event.insertMany(DEFAULT_EVENTS),
    Poll.insertMany(DEFAULT_POLLS),
    Comment.insertMany(DEFAULT_COMMENTS),
    Gallery.insertMany(DEFAULT_GALLERY),
    Permission.insertMany(DEFAULT_PERMISSIONS),
    HeroSettings.create(DEFAULT_HERO_SETTINGS),
    SiteSettings.create(DEFAULT_SITE_SETTINGS),
  ]);

  console.log('✓ Database seeded successfully!');
}

// ─── Run as standalone script ───
const scriptPath = fileURLToPath(import.meta.url).replace(/\\/g, '/');
const argPath = (process.argv[1] || '').replace(/\\/g, '/');
const isMain = argPath && scriptPath.endsWith(argPath.replace(/^\.\//, ''));
if (isMain || scriptPath.includes(argPath)) {
  mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/zemun-news')
    .then(() => seedAll())
    .then(() => { console.log('Done!'); process.exit(0); })
    .catch(err => { console.error(err); process.exit(1); });
}
