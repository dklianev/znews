import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  Article,
  Category,
  Classified,
  Court,
  Event,
  Job,
  User,
  Wanted,
} from '../../server/models.js';

const DERIVED_FIELD_MODELS = [
  User,
  Article,
  Category,
  Wanted,
  Job,
  Court,
  Event,
  Classified,
];

describe('models derived-field middleware', () => {
  let mongod;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri(), { dbName: 'models-derived-middleware-tests' });
    for (const Model of DERIVED_FIELD_MODELS) {
      await Model.init();
    }
  }, 45000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongod) {
      await mongod.stop();
    }
  });

  it('supports document creates without callback-style middleware errors', async () => {
    const user = await User.create({
      id: 99001,
      username: '  Admin.User  ',
      password: 'hashed-password',
      name: 'Админ',
      role: 'admin',
      createdAt: '2026-04-17',
    });
    expect(user.usernameLower).toBe('admin.user');

    const article = await Article.create({
      id: 9001,
      title: '  Шок новина  ',
      tags: ['  криминале  ', 'криминале', 'вътрешно'],
      date: '2026-04-17',
      status: 'published',
    });
    expect(article.titleSearch).toBe('шок новина');
    expect(article.tagsSearch).toEqual(['криминале', 'вътрешно']);
    expect(article.publishAtDate?.toISOString()).toBe('2026-04-17T00:00:00.000Z');

    const category = await Category.create({ id: 'hot-news', name: '  Горещо  ' });
    expect(category.nameSearch).toBe('горещо');
    expect(category.idSearch).toBe('hot-news');

    const wanted = await Wanted.create({ id: 9101, name: '  Иван  ', charge: '  Обир  ' });
    expect(wanted.nameSearch).toBe('иван');
    expect(wanted.chargeSearch).toBe('обир');

    const job = await Job.create({ id: 9201, title: '  Шофьор  ', org: '  Такси Зет  ', type: 'driver', date: '2026-04-17' });
    expect(job.titleSearch).toBe('шофьор');
    expect(job.orgSearch).toBe('такси зет');

    const court = await Court.create({ id: 9301, title: '  Дело  ', defendant: '  Пешо  ' });
    expect(court.titleSearch).toBe('дело');
    expect(court.defendantSearch).toBe('пешо');

    const event = await Event.create({
      id: 9401,
      title: '  Концерт  ',
      location: '  Център  ',
      date: '2026-04-17',
      time: '20:00',
      type: 'party',
    });
    expect(event.titleSearch).toBe('концерт');
    expect(event.locationSearch).toBe('център');

    const classified = await Classified.create({
      id: 9501,
      title: 'Продавам Sultan',
      description: 'Много запазен.',
      category: 'cars',
      contactName: 'Ники',
      phone: '0888123456',
      price: '12 500 $',
      paymentRef: 'pay-9501',
      status: 'awaiting_payment',
    });
    expect(classified.priceValue).toBe(12500);
  });

  it('keeps derived fields in sync on findOneAndUpdate', async () => {
    const article = await Article.create({
      id: 9601,
      title: 'Старо',
      tags: ['старо'],
      publishAt: new Date('2026-04-17T08:00:00.000Z'),
      status: 'published',
    });
    const updatedArticle = await Article.findOneAndUpdate(
      { id: article.id },
      {
        title: '  Ново заглавие  ',
        tags: ['  разследване  ', 'разследване', 'драма'],
        date: '2026-04-18',
        publishAt: null,
      },
      { returnDocument: 'after', runValidators: true }
    );
    expect(updatedArticle.titleSearch).toBe('ново заглавие');
    expect(updatedArticle.tagsSearch).toEqual(['разследване', 'драма']);
    expect(updatedArticle.publishAtDate?.toISOString()).toBe('2026-04-18T00:00:00.000Z');

    const user = await User.create({
      id: 99002,
      username: 'editor',
      password: 'hashed-password',
      name: 'Редактор',
      role: 'editor',
      createdAt: '2026-04-17',
    });
    const updatedUser = await User.findOneAndUpdate(
      { username: user.username },
      { username: '  Editor.New  ' },
      { returnDocument: 'after', runValidators: true }
    );
    expect(updatedUser.username).toBe('editor.new');
    expect(updatedUser.usernameLower).toBe('editor.new');

    const category = await Category.create({ id: 'events', name: 'Събития' });
    const updatedCategory = await Category.findOneAndUpdate(
      { id: category.id },
      { name: '  Афиш  ' },
      { returnDocument: 'after', runValidators: true }
    );
    expect(updatedCategory.nameSearch).toBe('афиш');

    const wanted = await Wanted.create({ id: 9701, name: 'Стар', charge: 'Старо' });
    const updatedWanted = await Wanted.findOneAndUpdate(
      { id: wanted.id },
      { name: '  Нов  ', charge: '  Измама  ' },
      { returnDocument: 'after', runValidators: true }
    );
    expect(updatedWanted.nameSearch).toBe('нов');
    expect(updatedWanted.chargeSearch).toBe('измама');

    const job = await Job.create({ id: 9801, title: 'Старо', org: 'Стара фирма', type: 'other', date: '2026-04-17' });
    const updatedJob = await Job.findOneAndUpdate(
      { id: job.id },
      { title: '  Репортер  ', org: '  ZNews  ' },
      { returnDocument: 'after', runValidators: true }
    );
    expect(updatedJob.titleSearch).toBe('репортер');
    expect(updatedJob.orgSearch).toBe('znews');

    const court = await Court.create({ id: 9901, title: 'Старо дело', defendant: 'Стар ответник' });
    const updatedCourt = await Court.findOneAndUpdate(
      { id: court.id },
      { title: '  Ново дело  ', defendant: '  Нов ответник  ' },
      { returnDocument: 'after', runValidators: true }
    );
    expect(updatedCourt.titleSearch).toBe('ново дело');
    expect(updatedCourt.defendantSearch).toBe('нов ответник');

    const event = await Event.create({
      id: 9911,
      title: 'Старо събитие',
      location: 'Стара локация',
      date: '2026-04-17',
      time: '18:00',
      type: 'party',
    });
    const updatedEvent = await Event.findOneAndUpdate(
      { id: event.id },
      { title: '  Ново събитие  ', location: '  Нова локация  ' },
      { returnDocument: 'after', runValidators: true }
    );
    expect(updatedEvent.titleSearch).toBe('ново събитие');
    expect(updatedEvent.locationSearch).toBe('нова локация');

    const classified = await Classified.create({
      id: 9921,
      title: 'Обява',
      description: 'Описание',
      category: 'other',
      contactName: 'Ники',
      phone: '0888123456',
      price: '5000',
      paymentRef: 'pay-9921',
      status: 'awaiting_payment',
    });
    const updatedClassified = await Classified.findOneAndUpdate(
      { id: classified.id },
      { price: '15 750 лв' },
      { returnDocument: 'after', runValidators: true }
    );
    expect(updatedClassified.priceValue).toBe(15750);
  });
});
