import mongoose from 'mongoose';

const opts = {
  toJSON: {
    transform: (_doc, ret) => {
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
};

// ─── Article ───
const articleSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  slug: String,
  title: String,
  excerpt: String,
  content: String,
  category: { type: String, index: true },
  authorId: { type: Number, index: true },
  date: String,
  readTime: Number,
  image: String,
  imageMeta: { type: mongoose.Schema.Types.Mixed, default: null },
  featured: { type: Boolean, default: false, index: true },
  breaking: { type: Boolean, default: false, index: true },
  hero: { type: Boolean, default: false, index: true },
  views: { type: Number, default: 0 },
  tags: [String],
  relatedArticles: [{ type: Number }],
  status: { type: String, default: 'published', enum: ['published', 'draft'] },
  publishAt: { type: Date, default: null, index: true },
  shareTitle: { type: String, default: '' },
  shareSubtitle: { type: String, default: '' },
  shareBadge: { type: String, default: '' },
  shareAccent: { type: String, default: 'auto' },
  shareImage: { type: String, default: '' },
  cardSticker: { type: String, default: '' },
}, opts);

// Full-text search for /api/articles?q=...
// Note: MongoDB allows only one text index per collection.
articleSchema.index(
  { title: 'text', excerpt: 'text', content: 'text', tags: 'text' },
  {
    name: 'article_text',
    weights: { title: 10, tags: 5, excerpt: 3, content: 1 },
    default_language: 'none',
  }
);

// ─── Author ───
const authorSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  name: String,
  avatar: String,
  role: String,
}, opts);

// ─── Category ───
const categorySchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: String,
  icon: String,
}, opts);

// ─── Ad ───
const adSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  type: String,
  title: String,
  subtitle: String,
  cta: String,
  gradient: String,
  icon: String,
  link: String,
  color: String,
  image: String,
  imagePlacement: { type: String, enum: ['circle', 'cover'], default: 'circle' },
}, opts);

// ─── Breaking ───
const breakingSchema = new mongoose.Schema({
  items: [String],
}, opts);

// ─── User (admin accounts) ───
const userSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  username: { type: String, index: true },
  password: String,
  name: String,
  role: String,
  profession: String,
  avatar: String,
  createdAt: String,
}, {
  toJSON: {
    transform: (_doc, ret) => {
      delete ret._id;
      delete ret.__v;
      delete ret.password;
      return ret;
    },
  },
});

// ─── Wanted ───
const wantedSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  name: String,
  bounty: String,
  charge: String,
  danger: String,
}, opts);

// ─── Job ───
const jobSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  title: String,
  org: String,
  type: String,
  description: String,
  requirements: String,
  salary: String,
  contact: String,
  date: String,
  active: { type: Boolean, default: true },
}, opts);

// ─── Court ───
const courtSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  title: String,
  defendant: String,
  charge: String,
  verdict: String,
  judge: String,
  date: String,
  details: String,
  severity: String,
  status: { type: String, default: 'completed', enum: ['completed', 'scheduled', 'ongoing'] },
  nextHearing: String,
}, opts);

// ─── Event ───
const eventSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  title: String,
  description: String,
  date: String,
  time: String,
  location: String,
  organizer: String,
  type: String,
  image: String,
}, opts);

// ─── Poll ───
const pollSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  question: String,
  options: [{ text: String, votes: { type: Number, default: 0 } }],
  active: { type: Boolean, default: true },
  createdAt: String,
}, opts);

// ─── Comment ───
const commentSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  articleId: { type: Number, required: true },
  author: { type: String, required: true, maxlength: 50 },
  avatar: String,
  text: { type: String, required: true, maxlength: 1200 },
  date: { type: String, required: true },
  approved: { type: Boolean, default: false },
}, opts);

// Public read path: find({ articleId, approved: true }).sort({ id: -1 })
commentSchema.index({ articleId: 1, approved: 1, id: -1 }, { name: 'comment_article_approved_id' });

// ─── Contact Messages ───
const contactMessageSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  name: { type: String, required: true, maxlength: 80 },
  email: { type: String, required: true, maxlength: 120, index: true },
  message: { type: String, required: true, maxlength: 4000 },
  status: { type: String, default: 'new', enum: ['new', 'read', 'archived'], index: true },
  createdAt: { type: Date, default: Date.now, index: true },
}, opts);

contactMessageSchema.index({ status: 1, createdAt: -1, id: -1 }, { name: 'contact_status_createdAt_id' });

// ─── Gallery ───
const gallerySchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  title: String,
  description: String,
  image: String,
  category: String,
  date: String,
  featured: { type: Boolean, default: false },
}, opts);

// ─── Permission ───
const permissionSchema = new mongoose.Schema({
  role: { type: String, required: true, unique: true },
  permissions: {
    articles: { type: Boolean, default: false },
    categories: { type: Boolean, default: false },
    ads: { type: Boolean, default: false },
    breaking: { type: Boolean, default: false },
    wanted: { type: Boolean, default: false },
    jobs: { type: Boolean, default: false },
    court: { type: Boolean, default: false },
    events: { type: Boolean, default: false },
    polls: { type: Boolean, default: false },
    comments: { type: Boolean, default: false },
    contact: { type: Boolean, default: false },
    gallery: { type: Boolean, default: false },
    profiles: { type: Boolean, default: false },
    permissions: { type: Boolean, default: false },
  },
}, opts);

// ─── Hero Settings (single document) ───
const heroSettingsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'main' },
  headline: String,
  shockLabel: String,
  ctaLabel: String,
  headlineBoardText: String,
  captions: [String],
  mainPhotoArticleId: Number,
  photoArticleIds: [Number],
}, opts);

// ─── Site Settings (single document) ───
const siteSettingsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'main' },
  navbarLinks: [{
    to: String,
    label: String,
    hot: Boolean,
  }],
  spotlightLinks: [{
    to: String,
    label: String,
    icon: String,
    hot: Boolean,
    tilt: String,
  }],
  footerPills: [{
    to: String,
    label: String,
    hot: Boolean,
    tilt: String,
  }],
  footerQuickLinks: [{
    to: String,
    label: String,
  }],
  footerInfoLinks: [{
    to: String,
    label: String,
  }],
  contact: {
    address: String,
    phone: String,
    email: String,
  },
  about: {
    heroText: String,
    missionTitle: String,
    missionParagraph1: String,
    missionParagraph2: String,
    adIntro: String,
    adPlans: [{
      name: String,
      price: String,
      desc: String,
    }],
  },
  layoutPresets: {
    homeFeatured: String,
    homeCrime: String,
    homeReportage: String,
    homeEmergency: String,
    articleRelated: String,
    categoryListing: String,
    searchListing: String,
  },
  tipLinePromo: {
    enabled: { type: Boolean, default: true },
    title: String,
    description: String,
    buttonLabel: String,
    buttonLink: String,
  },
}, opts);

// ─── Article Revisions ───
const articleRevisionSchema = new mongoose.Schema({
  revisionId: { type: String, required: true, unique: true, index: true },
  articleId: { type: Number, required: true, index: true },
  version: { type: Number, required: true, index: true },
  source: { type: String, default: 'update', enum: ['create', 'update', 'autosave', 'restore'] },
  editorName: String,
  editorId: Number,
  snapshot: { type: mongoose.Schema.Types.Mixed, required: true },
  createdAt: { type: Date, default: Date.now, index: true },
}, opts);

// ─── Settings Revisions ───
const settingsRevisionSchema = new mongoose.Schema({
  revisionId: { type: String, required: true, unique: true, index: true },
  scope: { type: String, required: true, enum: ['hero', 'site'], index: true },
  version: { type: Number, required: true, index: true },
  source: { type: String, default: 'update', enum: ['update', 'restore'] },
  editorName: String,
  editorId: Number,
  snapshot: { type: mongoose.Schema.Types.Mixed, required: true },
  createdAt: { type: Date, default: Date.now, index: true },
}, opts);
settingsRevisionSchema.index({ scope: 1, version: -1 });

// ─── Engagement Dedup (TTL) ───
const articleViewSchema = new mongoose.Schema({
  articleId: { type: Number, required: true, index: true },
  viewerHash: { type: String, required: true, index: true },
  windowKey: { type: Number, required: true, index: true },
  createdAt: { type: Date, default: Date.now, index: true },
  expiresAt: { type: Date, required: true },
}, opts);
articleViewSchema.index({ articleId: 1, viewerHash: 1, windowKey: 1 }, { unique: true });
articleViewSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const pollVoteSchema = new mongoose.Schema({
  pollId: { type: Number, required: true, index: true },
  voterHash: { type: String, required: true, index: true },
  windowKey: { type: Number, required: true, index: true },
  optionIndex: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now, index: true },
  expiresAt: { type: Date, required: true },
}, opts);
pollVoteSchema.index({ pollId: 1, voterHash: 1, windowKey: 1 }, { unique: true });
pollVoteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// ─── Auth Sessions (refresh-token rotation) ───
const authSessionSchema = new mongoose.Schema({
  jti: { type: String, required: true, unique: true, index: true },
  userId: { type: Number, required: true, index: true },
  userAgent: { type: String, default: '' },
  ipHash: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now, index: true },
  expiresAt: { type: Date, required: true },
}, opts);
authSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// ─── Audit Log ───
const auditLogSchema = new mongoose.Schema({
  user: String,
  userId: Number,
  action: { type: String, enum: ['create', 'update', 'delete'] },
  resource: String,
  resourceId: Number,
  details: String,
  timestamp: { type: Date, default: Date.now, index: true },
}, opts);

// ─── Tip (Tip Line) ───
const tipSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  text: String,
  location: String,
  image: String,
  imageMeta: { type: mongoose.Schema.Types.Mixed, default: null },
  status: { type: String, default: 'new', enum: ['new', 'processed', 'rejected'] },
  ipHash: { type: String, index: true },
  createdAt: { type: Date, default: Date.now, index: true },
}, opts);

// ─── Web Push Subscription ───
const pushSubscriptionSchema = new mongoose.Schema({
  endpoint: { type: String, required: true, unique: true },
  expirationTime: { type: Date, default: null },
  keys: {
    p256dh: { type: String, required: true },
    auth: { type: String, required: true }
  },
  createdAt: { type: Date, default: Date.now, index: true }
}, opts);

export const Article = mongoose.model('Article', articleSchema);
export const Author = mongoose.model('Author', authorSchema);
export const Category = mongoose.model('Category', categorySchema);
export const Ad = mongoose.model('Ad', adSchema);
export const Breaking = mongoose.model('Breaking', breakingSchema);
export const User = mongoose.model('User', userSchema);
export const Wanted = mongoose.model('Wanted', wantedSchema);
export const Job = mongoose.model('Job', jobSchema);
export const Court = mongoose.model('Court', courtSchema);
export const Event = mongoose.model('Event', eventSchema);
export const Poll = mongoose.model('Poll', pollSchema);
export const Comment = mongoose.model('Comment', commentSchema);
export const ContactMessage = mongoose.model('ContactMessage', contactMessageSchema);
export const Gallery = mongoose.model('Gallery', gallerySchema);
export const Permission = mongoose.model('Permission', permissionSchema);
export const HeroSettings = mongoose.model('HeroSettings', heroSettingsSchema);
export const SiteSettings = mongoose.model('SiteSettings', siteSettingsSchema);
export const ArticleRevision = mongoose.model('ArticleRevision', articleRevisionSchema);
export const SettingsRevision = mongoose.model('SettingsRevision', settingsRevisionSchema);
export const ArticleView = mongoose.model('ArticleView', articleViewSchema);
export const PollVote = mongoose.model('PollVote', pollVoteSchema);
export const AuthSession = mongoose.model('AuthSession', authSessionSchema);
export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
export const Tip = mongoose.model('Tip', tipSchema);
export const PushSubscription = mongoose.model('PushSubscription', pushSubscriptionSchema);
