import mongoose from 'mongoose';
import { AD_ANALYTICS_RETENTION_DAYS, AD_EVENT_TYPES } from '../shared/adAnalytics.js';
import {
  deriveArticlePublishAtDate,
  normalizeClassifiedPriceValue,
  normalizeSearchField,
  normalizeSearchList,
  normalizeUsernameLower,
} from './services/derivedFieldsService.js';

const opts = {
  toJSON: {
    transform: (_doc, ret) => {
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
};

function getUpdatedField(update, key) {
  if (!update || typeof update !== 'object') return undefined;
  if (Object.prototype.hasOwnProperty.call(update, key)) return update[key];
  if (update.$set && Object.prototype.hasOwnProperty.call(update.$set, key)) return update.$set[key];
  return undefined;
}

function hasUpdatedField(update, key) {
  if (!update || typeof update !== 'object') return false;
  return Object.prototype.hasOwnProperty.call(update, key)
    || Boolean(update.$set && Object.prototype.hasOwnProperty.call(update.$set, key));
}

function setDerivedUpdateField(update, key, value) {
  if (!update || typeof update !== 'object') return;
  update.$set = update.$set || {};
  update.$set[key] = value;
}

// ÄÄÄ Article ÄÄÄ
const articleSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  slug: String,
  title: String,
  titleSearch: { type: String, default: '' },
  excerpt: String,
  content: { type: String, maxlength: 100000 },
  category: { type: String, index: true },
  authorId: { type: Number, index: true },
  date: String,
  readTime: Number,
  image: String,
  imageMeta: { type: mongoose.Schema.Types.Mixed, default: null },
  youtubeUrl: { type: String, default: '' },
  featured: { type: Boolean, default: false, index: true },
  breaking: { type: Boolean, default: false, index: true },
  sponsored: { type: Boolean, default: false, index: true },
  hero: { type: Boolean, default: false, index: true },
  views: { type: Number, default: 0 },
  reactions: {
    fire: { type: Number, default: 0 },
    shock: { type: Number, default: 0 },
    laugh: { type: Number, default: 0 },
    skull: { type: Number, default: 0 },
    clap: { type: Number, default: 0 },
  },
  tags: [String],
  relatedArticles: [{ type: Number }],
  status: { type: String, default: 'published', enum: ['published', 'draft', 'archived'] },
  deletedAt: { type: Date, default: null },
  deletedBy: { type: String, default: null },
  publishAt: { type: Date, default: null, index: true },
  publishAtDate: { type: Date, default: null, index: true },
  tagsSearch: { type: [String], default: [] },
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
articleSchema.index({ status: 1, publishAt: -1, id: -1 }, { name: 'article_publish_sort' });
articleSchema.index({ status: 1, publishAtDate: -1, id: -1 }, { name: 'article_publish_sort_v2' });
articleSchema.index({ hero: 1, status: 1, publishAt: -1, id: -1 }, { name: 'article_hero_publish_sort' });
articleSchema.index({ featured: 1, status: 1, publishAt: -1, id: -1 }, { name: 'article_featured_publish_sort' });
articleSchema.index({ breaking: 1, status: 1, publishAt: -1, id: -1 }, { name: 'article_breaking_publish_sort' });
articleSchema.index({ sponsored: 1, status: 1, publishAt: -1, id: -1 }, { name: 'article_sponsored_publish_sort' });
articleSchema.index({ category: 1, status: 1, publishAt: -1, id: -1 }, { name: 'article_category_publish_sort' });
articleSchema.index({ status: 1, titleSearch: 1, publishAtDate: -1, id: -1 }, { name: 'article_title_search_prefix' });
articleSchema.index({ status: 1, tagsSearch: 1, publishAtDate: -1, id: -1 }, { name: 'article_tags_search_prefix' });

articleSchema.pre('validate', function syncArticleDerivedFields() {
  this.titleSearch = normalizeSearchField(this.title, 240);
  this.tagsSearch = normalizeSearchList(this.tags, 64, 24);
  this.publishAtDate = deriveArticlePublishAtDate(this);
});

articleSchema.pre('findOneAndUpdate', async function syncArticleDerivedFieldsOnUpdate() {
  const update = this.getUpdate();
  if (!update || typeof update !== 'object') {
    return;
  }

  if (hasUpdatedField(update, 'title')) {
    setDerivedUpdateField(update, 'titleSearch', normalizeSearchField(getUpdatedField(update, 'title'), 240));
  }
  if (hasUpdatedField(update, 'tags')) {
    setDerivedUpdateField(update, 'tagsSearch', normalizeSearchList(getUpdatedField(update, 'tags'), 64, 24));
  }

  if (hasUpdatedField(update, 'publishAt') || hasUpdatedField(update, 'date')) {
    let publishAt = getUpdatedField(update, 'publishAt');
    let date = getUpdatedField(update, 'date');

    if (publishAt === undefined || date === undefined) {
      const existing = await this.model.findOne(this.getQuery()).select({ _id: 0, publishAt: 1, date: 1 }).lean();
      if (publishAt === undefined) publishAt = existing?.publishAt;
      if (date === undefined) date = existing?.date;
    }

    setDerivedUpdateField(update, 'publishAtDate', deriveArticlePublishAtDate({ publishAt, date }));
  }

  this.setUpdate(update);
});

// ÄÄÄ Author ÄÄÄ
const authorSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  name: String,
  avatar: String,
  avatarImage: String,
  avatarImageMeta: {
    objectPosition: String,
    objectScale: Number,
  },
  role: String,
  bio: String,
  phone: String,
  email: String,
}, opts);

// ÄÄÄ Category ÄÄÄ
const categorySchema = new mongoose.Schema({
  id: {
    type: String,
    required: [true, 'Slug е задължителен.'],
    unique: true,
    trim: true,
    maxlength: [64, 'Slug-ът трябва да е до 64 символа.'],
    match: [/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug-ът може да съдържа само малки латински букви, цифри и тирета.'],
  },
  name: {
    type: String,
    required: [true, 'Името е задължително.'],
    trim: true,
    maxlength: [80, 'Името трябва да е до 80 символа.'],
  },
  nameSearch: {
    type: String,
    default: '',
  },
  idSearch: {
    type: String,
    default: '',
  },
  icon: {
    type: String,
    trim: true,
    maxlength: [16, 'Иконата трябва да е до 16 символа.'],
  },
}, opts);
categorySchema.index(
  { name: 'text', id: 'text' },
  { name: 'category_text', weights: { name: 6, id: 4 }, default_language: 'none' }
);
categorySchema.index({ nameSearch: 1 }, { name: 'category_name_search' });
categorySchema.index({ idSearch: 1 }, { name: 'category_id_search' });

categorySchema.pre('validate', function syncCategorySearchFields() {
  this.nameSearch = normalizeSearchField(this.name, 120);
  this.idSearch = normalizeSearchField(this.id, 80);
});

categorySchema.pre('findOneAndUpdate', function syncCategorySearchFieldsOnUpdate() {
  const update = this.getUpdate();
  if (!update || typeof update !== 'object') {
    return;
  }

  if (hasUpdatedField(update, 'name')) {
    setDerivedUpdateField(update, 'nameSearch', normalizeSearchField(getUpdatedField(update, 'name'), 120));
  }
  if (hasUpdatedField(update, 'id')) {
    setDerivedUpdateField(update, 'idSearch', normalizeSearchField(getUpdatedField(update, 'id'), 80));
  }
  this.setUpdate(update);
});

// ÄÄÄ Ad ÄÄÄ
const adTargetingSchema = new mongoose.Schema({
  pageTypes: { type: [String], default: [] },
  articleIds: { type: [Number], default: [] },
  categoryIds: { type: [String], default: [] },
  excludeArticleIds: { type: [Number], default: [] },
  excludeCategoryIds: { type: [String], default: [] },
}, { _id: false });

const adSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  type: { type: String, enum: ['horizontal', 'side', 'inline'], default: 'horizontal' },
  title: String,
  subtitle: String,
  showTitle: { type: Boolean, default: true },
  cta: String,
  showButton: { type: Boolean, default: true },
  clickable: { type: Boolean, default: true },
  gradient: String,
  icon: String,
  link: String,
  color: String,
  image: String,
  imageDesktop: String,
  imageMobile: String,
  imageMeta: { type: mongoose.Schema.Types.Mixed, default: null },
  imageMetaDesktop: { type: mongoose.Schema.Types.Mixed, default: null },
  imageMetaMobile: { type: mongoose.Schema.Types.Mixed, default: null },
  imagePlacement: { type: String, enum: ['circle', 'cover'], default: 'circle' },
  fitMode: { type: String, enum: ['cover', 'contain'], default: 'cover' },
  status: { type: String, enum: ['draft', 'active', 'paused', 'archived'], default: 'active', index: true },
  campaignName: { type: String, default: '' },
  notes: { type: String, default: '' },
  placements: { type: [String], default: [] },
  targeting: { type: adTargetingSchema, default: () => ({}) },
  priority: { type: Number, default: 0 },
  weight: { type: Number, default: 1 },
  startAt: { type: Date, default: null, index: true },
  endAt: { type: Date, default: null, index: true },
}, opts);

adSchema.index({ priority: -1, id: -1 }, { name: 'ad_priority_id' });

const adEventSchema = new mongoose.Schema({
  adId: { type: Number, required: true, index: true },
  eventType: { type: String, required: true, enum: AD_EVENT_TYPES, index: true },
  slot: { type: String, required: true, index: true },
  pageType: { type: String, required: true, index: true },
  articleId: { type: Number, default: null, index: true },
  categoryId: { type: String, default: '', index: true },
  viewerHash: { type: String, default: '', index: true },
  windowKey: { type: Number, default: null, index: true },
  createdAt: { type: Date, default: Date.now, index: true },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + (AD_ANALYTICS_RETENTION_DAYS * 24 * 60 * 60 * 1000)),
  },
}, opts);
adEventSchema.index(
  { adId: 1, slot: 1, pageType: 1, articleId: 1, categoryId: 1, viewerHash: 1, windowKey: 1 },
  {
    unique: true,
    partialFilterExpression: { eventType: 'impression' },
    name: 'ad_impression_dedupe',
  }
);
adEventSchema.index({ adId: 1, eventType: 1, createdAt: -1 }, { name: 'ad_event_summary' });
adEventSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// ÄÄÄ Breaking ÄÄÄ
const breakingSchema = new mongoose.Schema({
  items: [String],
}, opts);

// ─── User (admin accounts) ───
const userSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  username: {
    type: String,
    required: [true, 'Потребителското име е задължително.'],
    trim: true,
    lowercase: true,
    maxlength: [40, 'Потребителското име трябва да е до 40 символа.'],
  },
  usernameLower: {
    type: String,
    trim: true,
    lowercase: true,
    maxlength: [40, 'Нормализираното потребителско име трябва да е до 40 символа.'],
    sparse: true,
  },
  password: {
    type: String,
    required: [true, 'Паролата е задължителна.'],
  },
  name: {
    type: String,
    required: [true, 'Името е задължително.'],
    trim: true,
    maxlength: [80, 'Името трябва да е до 80 символа.'],
  },
  role: {
    type: String,
    required: [true, 'Ролята е задължителна.'],
    trim: true,
    maxlength: [32, 'Ролята трябва да е до 32 символа.'],
  },
  profession: {
    type: String,
    trim: true,
    maxlength: [120, 'Професията трябва да е до 120 символа.'],
  },
  avatar: {
    type: String,
    trim: true,
    maxlength: [16, 'Аватарът трябва да е до 16 символа.'],
  },
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
userSchema.index({ usernameLower: 1 }, { unique: true, sparse: true, name: 'user_username_lower' });

userSchema.pre('validate', function syncUsernameLower() {
  this.usernameLower = normalizeUsernameLower(this.username);
});

userSchema.pre('findOneAndUpdate', function syncUsernameLowerOnUpdate() {
  const update = this.getUpdate();
  if (!update || typeof update !== 'object') {
    return;
  }

  const nextUsername = Object.prototype.hasOwnProperty.call(update, 'username')
    ? update.username
    : update.$set?.username;
  if (typeof nextUsername !== 'string') {
    return;
  }

  const usernameLower = normalizeUsernameLower(nextUsername);
  if (Object.prototype.hasOwnProperty.call(update, 'username')) {
    update.username = usernameLower;
    update.usernameLower = usernameLower;
  } else {
    update.$set = update.$set || {};
    update.$set.username = usernameLower;
    update.$set.usernameLower = usernameLower;
  }

  this.setUpdate(update);
});

// ─── Wanted ───
const wantedSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  name: String,
  nameSearch: { type: String, default: '' },
  bounty: String,
  charge: String,
  chargeSearch: { type: String, default: '' },
  danger: String,
}, opts);
wantedSchema.index(
  { name: 'text', charge: 'text', danger: 'text' },
  { name: 'wanted_text', weights: { name: 8, charge: 5, danger: 2 }, default_language: 'none' }
);
wantedSchema.index({ nameSearch: 1, id: -1 }, { name: 'wanted_name_search' });
wantedSchema.index({ chargeSearch: 1, id: -1 }, { name: 'wanted_charge_search' });

wantedSchema.pre('validate', function syncWantedSearchFields() {
  this.nameSearch = normalizeSearchField(this.name, 160);
  this.chargeSearch = normalizeSearchField(this.charge, 160);
});

wantedSchema.pre('findOneAndUpdate', function syncWantedSearchFieldsOnUpdate() {
  const update = this.getUpdate();
  if (!update || typeof update !== 'object') {
    return;
  }

  if (hasUpdatedField(update, 'name')) {
    setDerivedUpdateField(update, 'nameSearch', normalizeSearchField(getUpdatedField(update, 'name'), 160));
  }
  if (hasUpdatedField(update, 'charge')) {
    setDerivedUpdateField(update, 'chargeSearch', normalizeSearchField(getUpdatedField(update, 'charge'), 160));
  }
  this.setUpdate(update);
});

// ─── Job ───
const jobSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  title: {
    type: String,
    required: [true, 'Заглавието е задължително.'],
    trim: true,
    maxlength: [120, 'Заглавието трябва да е до 120 символа.'],
  },
  titleSearch: { type: String, default: '' },
  org: {
    type: String,
    required: [true, 'Организацията е задължителна.'],
    trim: true,
    maxlength: [120, 'Организацията трябва да е до 120 символа.'],
  },
  orgSearch: { type: String, default: '' },
  type: {
    type: String,
    required: [true, 'Типът е задължителен.'],
    enum: ['police', 'ems', 'mechanic', 'lawyer', 'driver', 'government', 'other'],
  },
  description: {
    type: String,
    trim: true,
    maxlength: [2000, 'Описанието трябва да е до 2000 символа.'],
  },
  requirements: {
    type: String,
    trim: true,
    maxlength: [600, 'Изискванията трябва да са до 600 символа.'],
  },
  salary: {
    type: String,
    trim: true,
    maxlength: [120, 'Заплащането трябва да е до 120 символа.'],
  },
  contact: {
    type: String,
    trim: true,
    maxlength: [160, 'Контактът трябва да е до 160 символа.'],
  },
  date: {
    type: String,
    required: [true, 'Датата е задължителна.'],
    trim: true,
    maxlength: [32, 'Датата трябва да е до 32 символа.'],
  },
  active: { type: Boolean, default: true },
}, opts);
jobSchema.index(
  { title: 'text', org: 'text', description: 'text', requirements: 'text' },
  { name: 'job_text', weights: { title: 8, org: 6, description: 4, requirements: 2 }, default_language: 'none' }
);
jobSchema.index({ active: 1, id: -1 }, { name: 'job_active_id' });
jobSchema.index({ titleSearch: 1, id: -1 }, { name: 'job_title_search' });
jobSchema.index({ orgSearch: 1, id: -1 }, { name: 'job_org_search' });

jobSchema.pre('validate', function syncJobSearchFields() {
  this.titleSearch = normalizeSearchField(this.title, 180);
  this.orgSearch = normalizeSearchField(this.org, 180);
});

jobSchema.pre('findOneAndUpdate', function syncJobSearchFieldsOnUpdate() {
  const update = this.getUpdate();
  if (!update || typeof update !== 'object') {
    return;
  }

  if (hasUpdatedField(update, 'title')) {
    setDerivedUpdateField(update, 'titleSearch', normalizeSearchField(getUpdatedField(update, 'title'), 180));
  }
  if (hasUpdatedField(update, 'org')) {
    setDerivedUpdateField(update, 'orgSearch', normalizeSearchField(getUpdatedField(update, 'org'), 180));
  }
  this.setUpdate(update);
});

// ─── Court ───
const courtSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  title: String,
  titleSearch: { type: String, default: '' },
  defendant: String,
  defendantSearch: { type: String, default: '' },
  charge: String,
  verdict: String,
  judge: String,
  date: String,
  details: String,
  severity: String,
  status: { type: String, default: 'completed', enum: ['completed', 'scheduled', 'ongoing'] },
  nextHearing: String,
}, opts);
courtSchema.index(
  { title: 'text', defendant: 'text', charge: 'text', details: 'text', verdict: 'text' },
  { name: 'court_text', weights: { title: 7, defendant: 6, charge: 6, details: 3, verdict: 2 }, default_language: 'none' }
);
courtSchema.index({ status: 1, id: -1 }, { name: 'court_status_id' });
courtSchema.index({ titleSearch: 1, id: -1 }, { name: 'court_title_search' });
courtSchema.index({ defendantSearch: 1, id: -1 }, { name: 'court_defendant_search' });

courtSchema.pre('validate', function syncCourtSearchFields() {
  this.titleSearch = normalizeSearchField(this.title, 180);
  this.defendantSearch = normalizeSearchField(this.defendant, 180);
});

courtSchema.pre('findOneAndUpdate', function syncCourtSearchFieldsOnUpdate() {
  const update = this.getUpdate();
  if (!update || typeof update !== 'object') {
    return;
  }

  if (hasUpdatedField(update, 'title')) {
    setDerivedUpdateField(update, 'titleSearch', normalizeSearchField(getUpdatedField(update, 'title'), 180));
  }
  if (hasUpdatedField(update, 'defendant')) {
    setDerivedUpdateField(update, 'defendantSearch', normalizeSearchField(getUpdatedField(update, 'defendant'), 180));
  }
  this.setUpdate(update);
});

// ─── Event ───
const eventSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  title: {
    type: String,
    required: [true, 'Заглавието е задължително.'],
    trim: true,
    maxlength: [120, 'Заглавието трябва да е до 120 символа.'],
  },
  titleSearch: { type: String, default: '' },
  description: {
    type: String,
    trim: true,
    maxlength: [2000, 'Описанието трябва да е до 2000 символа.'],
  },
  date: {
    type: String,
    required: [true, 'Датата е задължителна.'],
    trim: true,
    maxlength: [32, 'Датата трябва да е до 32 символа.'],
  },
  time: {
    type: String,
    trim: true,
    maxlength: [32, 'Часът трябва да е до 32 символа.'],
  },
  location: {
    type: String,
    required: [true, 'Локацията е задължителна.'],
    trim: true,
    maxlength: [160, 'Локацията трябва да е до 160 символа.'],
  },
  locationSearch: { type: String, default: '' },
  organizer: {
    type: String,
    trim: true,
    maxlength: [120, 'Организаторът трябва да е до 120 символа.'],
  },
  type: {
    type: String,
    required: [true, 'Типът е задължителен.'],
    enum: ['race', 'party', 'tournament', 'meeting', 'concert', 'other'],
  },
  image: {
    type: String,
    trim: true,
    maxlength: [16, 'Иконата трябва да е до 16 символа.'],
  },
}, opts);
eventSchema.index(
  { title: 'text', description: 'text', location: 'text', organizer: 'text', type: 'text' },
  { name: 'event_text', weights: { title: 8, location: 6, organizer: 4, type: 3, description: 2 }, default_language: 'none' }
);
eventSchema.index({ type: 1, id: -1 }, { name: 'event_type_id' });
eventSchema.index({ titleSearch: 1, id: -1 }, { name: 'event_title_search' });
eventSchema.index({ locationSearch: 1, id: -1 }, { name: 'event_location_search' });

eventSchema.pre('validate', function syncEventSearchFields() {
  this.titleSearch = normalizeSearchField(this.title, 180);
  this.locationSearch = normalizeSearchField(this.location, 180);
});

eventSchema.pre('findOneAndUpdate', function syncEventSearchFieldsOnUpdate() {
  const update = this.getUpdate();
  if (!update || typeof update !== 'object') {
    return;
  }

  if (hasUpdatedField(update, 'title')) {
    setDerivedUpdateField(update, 'titleSearch', normalizeSearchField(getUpdatedField(update, 'title'), 180));
  }
  if (hasUpdatedField(update, 'location')) {
    setDerivedUpdateField(update, 'locationSearch', normalizeSearchField(getUpdatedField(update, 'location'), 180));
  }
  this.setUpdate(update);
});

// ─── Poll ───
const pollOptionSchema = new mongoose.Schema({
  text: {
    type: String,
    required: [true, 'Всяка опция трябва да има текст.'],
    trim: true,
    maxlength: [120, 'Опциите трябва да са до 120 символа.'],
  },
  votes: {
    type: Number,
    default: 0,
    min: [0, 'Броят гласове не може да е отрицателен.'],
  },
}, { _id: false });

const pollSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  question: {
    type: String,
    required: [true, 'Въпросът е задължителен.'],
    trim: true,
    maxlength: [240, 'Въпросът трябва да е до 240 символа.'],
  },
  options: {
    type: [pollOptionSchema],
    default: [],
    validate: [
      {
        validator(options) {
          return Array.isArray(options) && options.length >= 2;
        },
        message: 'Добави поне две опции.',
      },
      {
        validator(options) {
          return Array.isArray(options) && options.length <= 6;
        },
        message: 'Позволени са най-много шест опции.',
      },
    ],
  },
  active: { type: Boolean, default: true },
  createdAt: {
    type: String,
    required: [true, 'Датата на създаване е задължителна.'],
    trim: true,
  },
}, opts);

// ─── Comment ───
const commentSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  articleId: { type: Number, required: true },
  parentId: { type: Number, default: null, index: true },
  author: { type: String, required: true, maxlength: 50 },
  avatar: String,
  text: { type: String, required: true, maxlength: 1200 },
  date: { type: String, required: true },
  likes: { type: Number, default: 0, min: 0 },
  dislikes: { type: Number, default: 0, min: 0 },
  approved: { type: Boolean, default: false },
}, opts);

// Public read path: find({ articleId, approved: true }).sort({ id: -1 })
commentSchema.index({ articleId: 1, approved: 1, parentId: 1, id: -1 }, { name: 'comment_article_approved_parent_id' });
commentSchema.index({ parentId: 1, id: 1 }, { name: 'comment_parent_id' });

const commentReactionSchema = new mongoose.Schema({
  commentId: { type: Number, required: true, index: true },
  voterHash: { type: String, required: true, index: true },
  value: { type: String, required: true, enum: ['like', 'dislike'] },
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now },
}, opts);

commentReactionSchema.index(
  { commentId: 1, voterHash: 1 },
  { unique: true, name: 'comment_reaction_comment_voter' }
);
commentReactionSchema.index(
  { commentId: 1, value: 1 },
  { name: 'comment_reaction_comment_value' }
);

// ─── Contact Messages ───
const contactMessageSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  name: { type: String, required: true, maxlength: 80 },
  phone: { type: String, required: true, maxlength: 30, index: true },
  email: { type: String, maxlength: 120, index: true },
  message: { type: String, required: true, maxlength: 4000 },
  requestKind: { type: String, default: 'general', enum: ['general', 'correction', 'right_of_reply'], index: true },
  relatedArticleId: { type: Number, default: null, index: true },
  relatedArticleTitle: { type: String, default: '', maxlength: 220 },
  responseArticleId: { type: Number, default: null, index: true },
  responseArticleStatus: { type: String, default: '', enum: ['', 'draft', 'published', 'archived'] },
  status: { type: String, default: 'new', enum: ['new', 'read', 'archived'], index: true },
  assignedEditor: { type: String, default: '', maxlength: 80 },
  priority: { type: String, default: 'normal', enum: ['low', 'normal', 'high', 'urgent'], index: true },
  tags: [{ type: String, trim: true, maxlength: 24 }],
  dueAt: { type: Date, default: null, index: true },
  lastActionAt: { type: Date, default: null, index: true },
  lastActionBy: { type: String, default: '', maxlength: 80 },
  createdAt: { type: Date, default: Date.now, index: true },
}, opts);

contactMessageSchema.index({ status: 1, createdAt: -1, id: -1 }, { name: 'contact_status_createdAt_id' });
contactMessageSchema.index({ requestKind: 1, createdAt: -1, id: -1 }, { name: 'contact_requestKind_createdAt_id' });
contactMessageSchema.index(
  { requestKind: 1, relatedArticleId: 1, responseArticleStatus: 1, lastActionAt: -1, createdAt: -1, id: -1 },
  { name: 'contact_right_of_reply_lookup' }
);

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

gallerySchema.index({ featured: 1, date: -1 }, { name: 'gallery_featured_date' });
gallerySchema.index({ category: 1, date: -1 }, { name: 'gallery_category_date' });

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
    games: { type: Boolean, default: false },
    classifieds: { type: Boolean, default: false },
  },
}, opts);

// ─── Hero Settings (single document) ───
const heroSettingsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'main' },
  headline: String,
  shockLabel: String,
  ctaLabel: String,
  headlineBoardText: String,
  heroTitleScale: { type: Number, default: 100 },
  captions: [String],
  mainPhotoArticleId: Number,
  photoArticleIds: [Number],
}, opts);

// ─── Site Settings (single document) ───
const siteSettingsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'main' },
  breakingBadgeLabel: String,
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
  classifieds: {
    tiers: {
      standard:    { price: Number, durationDays: Number, maxImages: Number },
      highlighted: { price: Number, durationDays: Number, maxImages: Number },
      vip:         { price: Number, durationDays: Number, maxImages: Number },
    },
    bumpPrice: Number,
    renewalDiscount: Number,
    iban: String,
    beneficiary: String,
    currency: String,
  },
  seasonalCampaigns: {
    easter: {
      enabled: { type: Boolean, default: false },
      autoWindow: { type: Boolean, default: true },
      startAt: { type: Date, default: null },
      endAt: { type: Date, default: null },
      decorationsEnabled: { type: Boolean, default: true },
      variantSet: { type: String, default: 'classic' },
      maxVisibleEggs: { type: Number, default: 2 },
      huntEnabled: { type: Boolean, default: false },
      huntEggCount: { type: Number, default: 6 },
      huntRewardText: { type: String, default: '' },
      huntVersion: { type: Number, default: 1 },
      showProgress: { type: Boolean, default: true },
    },
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
articleRevisionSchema.index({ articleId: 1, createdAt: -1 }, { name: 'article_revision_article_createdAt' });

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

const articleReactionSchema = new mongoose.Schema({
  articleId: { type: Number, required: true, index: true },
  emoji: { type: String, required: true },
  voterHash: { type: String, required: true, index: true },
  windowKey: { type: Number, required: true, index: true },
  createdAt: { type: Date, default: Date.now, index: true },
  expiresAt: { type: Date, required: true },
}, opts);
articleReactionSchema.index({ articleId: 1, emoji: 1, voterHash: 1, windowKey: 1 }, { unique: true });
articleReactionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

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
  assignedEditor: { type: String, default: '', maxlength: 80 },
  priority: { type: String, default: 'normal', enum: ['low', 'normal', 'high', 'urgent'], index: true },
  tags: [{ type: String, trim: true, maxlength: 24 }],
  dueAt: { type: Date, default: null, index: true },
  lastActionAt: { type: Date, default: null, index: true },
  lastActionBy: { type: String, default: '', maxlength: 80 },
  ipHash: { type: String, index: true },
  createdAt: { type: Date, default: Date.now, index: true },
}, opts);

tipSchema.index({ status: 1, createdAt: -1, id: -1 }, { name: 'tip_status_createdAt_id' });

// ─── Classifieds (Малки обяви) ───
const classifiedSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  title: {
    type: String,
    required: [true, 'Заглавието е задължително.'],
    trim: true,
    maxlength: [120, 'Заглавието трябва да е до 120 символа.'],
  },
  description: {
    type: String,
    required: [true, 'Описанието е задължително.'],
    trim: true,
    maxlength: [1000, 'Описанието трябва да е до 1000 символа.'],
  },
  category: {
    type: String,
    required: [true, 'Категорията е задължителна.'],
    enum: ['cars', 'properties', 'services', 'looking-for', 'selling', 'other'],
  },
  price: { type: String, trim: true, maxlength: [60, 'Цената трябва да е до 60 символа.'] },
  priceValue: { type: Number, default: null, index: true },
  phone: {
    type: String,
    required: [true, 'Телефонът е задължителен.'],
    trim: true,
    maxlength: [30, 'Телефонът трябва да е до 30 символа.'],
  },
  contactName: {
    type: String,
    required: [true, 'Името за контакт е задължително.'],
    trim: true,
    maxlength: [80, 'Името трябва да е до 80 символа.'],
  },
  images: { type: [String], default: [] },
  imagesMeta: { type: [mongoose.Schema.Types.Mixed], default: [] },
  tier: { type: String, default: 'standard', enum: ['standard', 'highlighted', 'vip'] },
  status: { type: String, default: 'awaiting_payment', enum: ['awaiting_payment', 'active', 'rejected', 'expired'] },
  paymentRef: { type: String, required: true, unique: true, index: true },
  amountDue: { type: Number, default: 0 },
  currency: { type: String, default: '$', maxlength: 10 },
  paidBy: { type: String, default: '' },
  ipHash: { type: String, index: true },
  viewCount: { type: Number, default: 0 },
  sortWeight: { type: Number, default: 1 },
  bumpedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  approvedAt: { type: Date, default: null },
  expiresAt: { type: Date, default: null },
}, opts);

classifiedSchema.index(
  { title: 'text', description: 'text', contactName: 'text' },
  { name: 'classified_text', weights: { title: 8, description: 4, contactName: 2 }, default_language: 'none' }
);
classifiedSchema.index({ status: 1, expiresAt: -1, id: -1 }, { name: 'classified_status_expiry' });
classifiedSchema.index({ status: 1, category: 1, id: -1 }, { name: 'classified_status_category' });
classifiedSchema.index({ status: 1, priceValue: 1, id: -1 }, { name: 'classified_status_price' });
classifiedSchema.index({ status: 1, category: 1, priceValue: 1, id: -1 }, { name: 'classified_status_category_price' });

classifiedSchema.pre('validate', function syncClassifiedPriceValue() {
  this.priceValue = normalizeClassifiedPriceValue(this.price);
});

classifiedSchema.pre('findOneAndUpdate', function syncClassifiedPriceValueOnUpdate() {
  const update = this.getUpdate();
  if (!update || typeof update !== 'object') {
    return;
  }

  const nextPrice = Object.prototype.hasOwnProperty.call(update, 'price')
    ? update.price
    : update.$set?.price;
  if (typeof nextPrice === 'undefined') {
    return;
  }

  const priceValue = normalizeClassifiedPriceValue(nextPrice);
  if (Object.prototype.hasOwnProperty.call(update, 'price')) {
    update.priceValue = priceValue;
  } else {
    update.$set = update.$set || {};
    update.$set.priceValue = priceValue;
  }

  this.setUpdate(update);
});

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
const counterSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, index: true },
  seq: { type: Number, required: true, default: 0 },
  updatedAt: { type: Date, default: Date.now },
}, opts);

// ─── Games ───
const gameDefinitionSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  slug: { type: String, required: true, unique: true, index: true },
  title: String,
  type: { type: String, enum: ['word', 'connections', 'quiz', 'sudoku', 'hangman', 'crossword', 'spellingbee', 'strands', 'tetris', 'snake', '2048', 'flappybird', 'blockbust'], required: true },
  description: String,
  icon: String,
  active: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
  theme: String,
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now },
}, opts);
gameDefinitionSchema.index({ active: 1, sortOrder: 1, id: -1 }, { name: 'game_definition_active_sort' });

const gamePuzzleSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  gameSlug: { type: String, required: true, index: true },
  puzzleDate: { type: String, required: true },
  activeUntilDate: { type: String, default: null, index: true },
  status: { type: String, default: 'draft', enum: ['draft', 'published', 'archived'], index: true },
  publishAt: { type: Date, default: null, index: true },
  difficulty: String,
  payload: { type: mongoose.Schema.Types.Mixed },
  solution: { type: mongoose.Schema.Types.Mixed },
  editorNotes: String,
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now },
}, opts);
gamePuzzleSchema.index({ gameSlug: 1, puzzleDate: 1 }, { unique: true, name: 'game_puzzle_slug_date' });
gamePuzzleSchema.index({ gameSlug: 1, status: 1, puzzleDate: -1, activeUntilDate: -1 }, { name: 'game_puzzle_public_archive' });

const searchQueryStatSchema = new mongoose.Schema({
  normalizedQuery: { type: String, required: true, unique: true, index: true },
  displayQuery: { type: String, required: true },
  count: { type: Number, default: 0, min: 0 },
  lastSearchedAt: { type: Date, default: Date.now, index: true },
}, opts);
searchQueryStatSchema.index({ count: -1, lastSearchedAt: -1 }, { name: 'search_query_popularity' });

const systemEventSchema = new mongoose.Schema({
  fingerprint: { type: String, required: true, unique: true, index: true },
  level: { type: String, default: 'error', enum: ['info', 'warn', 'error'], index: true },
  source: { type: String, default: 'server', index: true },
  component: { type: String, default: '', index: true },
  message: { type: String, required: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: null },
  count: { type: Number, default: 1, min: 1 },
  firstSeenAt: { type: Date, default: Date.now, index: true },
  lastSeenAt: { type: Date, default: Date.now, index: true },
  expiresAt: { type: Date, default: () => new Date(Date.now() + (90 * 24 * 60 * 60 * 1000)) },
}, opts);
systemEventSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'system_event_expiry' });
systemEventSchema.index({ level: 1, lastSeenAt: -1 }, { name: 'system_event_level_last_seen' });

const backgroundJobStateSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, index: true },
  running: { type: Boolean, default: false, index: true },
  enabled: { type: Boolean, default: true },
  lockUntil: { type: Date, default: null, index: true },
  lastStartedAt: { type: Date, default: null },
  lastFinishedAt: { type: Date, default: null },
  lastSuccessAt: { type: Date, default: null },
  lastFailureAt: { type: Date, default: null },
  lastDurationMs: { type: Number, default: 0 },
  runCount: { type: Number, default: 0 },
  successCount: { type: Number, default: 0 },
  failureCount: { type: Number, default: 0 },
  lastMessage: { type: String, default: '' },
  metrics: { type: mongoose.Schema.Types.Mixed, default: null },
  updatedAt: { type: Date, default: Date.now, index: true },
}, opts);
backgroundJobStateSchema.index({ updatedAt: -1 }, { name: 'background_job_updatedAt' });

const adAnalyticsAggregateSchema = new mongoose.Schema({
  bucketDate: { type: String, required: true, index: true },
  adId: { type: Number, required: true, index: true },
  slot: { type: String, required: true, index: true },
  pageType: { type: String, required: true, index: true },
  articleId: { type: Number, default: null, index: true },
  categoryId: { type: String, default: '', index: true },
  impressions: { type: Number, default: 0, min: 0 },
  clicks: { type: Number, default: 0, min: 0 },
  ctr: { type: Number, default: 0, min: 0 },
  aggregatedAt: { type: Date, default: Date.now, index: true },
}, opts);
adAnalyticsAggregateSchema.index(
  { bucketDate: 1, adId: 1, slot: 1, pageType: 1, articleId: 1, categoryId: 1 },
  { unique: true, name: 'ad_analytics_aggregate_bucket' }
);
adAnalyticsAggregateSchema.index({ aggregatedAt: -1 }, { name: 'ad_analytics_aggregate_updated' });

export const Article = mongoose.model('Article', articleSchema);
export const Author = mongoose.model('Author', authorSchema);
export const Category = mongoose.model('Category', categorySchema);
export const Ad = mongoose.model('Ad', adSchema);
export const AdEvent = mongoose.model('AdEvent', adEventSchema);
export const Breaking = mongoose.model('Breaking', breakingSchema);
export const User = mongoose.model('User', userSchema);
export const Wanted = mongoose.model('Wanted', wantedSchema);
export const Job = mongoose.model('Job', jobSchema);
export const Court = mongoose.model('Court', courtSchema);
export const Event = mongoose.model('Event', eventSchema);
export const Poll = mongoose.model('Poll', pollSchema);
export const Comment = mongoose.model('Comment', commentSchema);
export const CommentReaction = mongoose.model('CommentReaction', commentReactionSchema);
export const ContactMessage = mongoose.model('ContactMessage', contactMessageSchema);
export const Gallery = mongoose.model('Gallery', gallerySchema);
export const Permission = mongoose.model('Permission', permissionSchema);
export const HeroSettings = mongoose.model('HeroSettings', heroSettingsSchema);
export const SiteSettings = mongoose.model('SiteSettings', siteSettingsSchema);
export const ArticleRevision = mongoose.model('ArticleRevision', articleRevisionSchema);
export const SettingsRevision = mongoose.model('SettingsRevision', settingsRevisionSchema);
export const ArticleView = mongoose.model('ArticleView', articleViewSchema);
export const PollVote = mongoose.model('PollVote', pollVoteSchema);
export const ArticleReaction = mongoose.model('ArticleReaction', articleReactionSchema);
export const AuthSession = mongoose.model('AuthSession', authSessionSchema);
export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
export const Tip = mongoose.model('Tip', tipSchema);
export const Classified = mongoose.model('Classified', classifiedSchema);
export const PushSubscription = mongoose.model('PushSubscription', pushSubscriptionSchema);
export const GameDefinition = mongoose.model('GameDefinition', gameDefinitionSchema);
export const GamePuzzle = mongoose.model('GamePuzzle', gamePuzzleSchema);
export const Counter = mongoose.model('Counter', counterSchema);
export const SystemEvent = mongoose.model('SystemEvent', systemEventSchema);
export const BackgroundJobState = mongoose.model('BackgroundJobState', backgroundJobStateSchema);
export const AdAnalyticsAggregate = mongoose.model('AdAnalyticsAggregate', adAnalyticsAggregateSchema);


export const SearchQueryStat = mongoose.models.SearchQueryStat || mongoose.model('SearchQueryStat', searchQueryStatSchema);
