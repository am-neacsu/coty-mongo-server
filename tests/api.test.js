const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../app');
const Judge = require('../models/Judge');
const Competitor = require('../models/Competitor');
const Assignment = require('../models/Assignment');
const Review = require('../models/Review');
const Category = require('../models/Category');
const RegistrationSettings = require('../models/RegistrationSettings');
const RegistrationHeat = require('../models/RegistrationHeat');
const Club = require('../models/Club');
const RegistrationTimingCategory = require('../models/RegistrationTimingCategory');
const CompetitorRegistration = require('../models/CompetitorRegistration');

jest.mock('../models/Judge');
jest.mock('../models/Competitor');
jest.mock('../models/Assignment');
jest.mock('../models/Review');
jest.mock('../models/Category');
jest.mock('../models/RegistrationSettings');
jest.mock('../models/RegistrationHeat');
jest.mock('../models/Club');
jest.mock('../models/RegistrationTimingCategory');
jest.mock('../models/CompetitorRegistration');

const JWT_SECRET = process.env.JWT_SECRET || 'local-dev-secret-change-me';

function mockQuery(result) {
  return {
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockResolvedValue(result),
  };
}

function tokenFor(overrides = {}) {
  return jwt.sign(
    {
      id: new mongoose.Types.ObjectId().toString(),
      username: 'test-user',
      isAdmin: false,
      ...overrides,
    },
    JWT_SECRET,
    { expiresIn: '12h' }
  );
}

function managerRegistrationToken() {
  return jwt.sign(
    { type: 'manager-registration' },
    process.env.REGISTRATION_ACCESS_SECRET || process.env.JWT_SECRET || 'local-registration-secret-change-me',
    { expiresIn: '12h' }
  );
}

describe('Express API', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  test('GET / returns root health message', async () => {
    const res = await request(app).get('/');

    expect(res.status).toBe(200);
    expect(res.text).toBe('Competition Review API is running.');
  });

  test('GET /api/health returns ok service status', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({
      status: 'ok',
      service: 'coty-api',
      database: expect.any(String),
      timestamp: expect.any(String),
    }));
  });

  test('POST /api/auth/login succeeds with valid credentials', async () => {
    Judge.findOne.mockResolvedValue({
      _id: new mongoose.Types.ObjectId(),
      username: 'admin',
      password: 'correct-password',
      isAdmin: true,
      location: 'HQ',
      table: '1',
      toObject() {
        return {
          _id: this._id,
          username: this.username,
          password: this.password,
          isAdmin: this.isAdmin,
          location: this.location,
          table: this.table,
        };
      },
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'correct-password' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.isAdmin).toBe(true);
    expect(res.body.user).toEqual(expect.objectContaining({ username: 'admin', isAdmin: true }));
    expect(res.body.user.password).toBeUndefined();
  });

  test('POST /api/auth/login rejects invalid credentials', async () => {
    Judge.findOne.mockResolvedValue({
      _id: new mongoose.Types.ObjectId(),
      username: 'admin',
      password: 'correct-password',
      isAdmin: true,
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: 'Invalid credentials' });
  });

  test('protected admin route rejects requests with no token', async () => {
    const res = await request(app)
      .post('/api/judges')
      .send({ username: 'newjudge', password: 'secret' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: 'Authentication required' });
  });

  test('protected admin route rejects malformed bearer token', async () => {
    const res = await request(app)
      .post('/api/judges')
      .set('Authorization', 'Bearer not-a-valid-jwt')
      .send({ username: 'newjudge', password: 'secret' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: 'Invalid or expired session' });
    expect(Judge).not.toHaveBeenCalled();
  });

  test('non-admin token is rejected from admin route', async () => {
    const res = await request(app)
      .post('/api/competitors')
      .set('Authorization', `Bearer ${tokenFor({ isAdmin: false })}`)
      .send({ name: 'Rejected Competitor', category: 'Under 2 years' });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ message: 'Admin access required' });
    expect(Competitor).not.toHaveBeenCalled();
  });

  test('admin token can create competitor on protected route', async () => {
    const savedCompetitor = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Created Competitor',
      category: 'Under 2 years',
      location: 'Ring 1',
      save: jest.fn().mockResolvedValue(undefined),
    };
    Competitor.mockImplementation(function CompetitorMock(data) {
      Object.assign(savedCompetitor, data);
      return savedCompetitor;
    });

    const res = await request(app)
      .post('/api/competitors')
      .set('Authorization', `Bearer ${tokenFor({ isAdmin: true })}`)
      .send({ name: '  Created Competitor  ', category: 'Under 2 years', location: 'Ring 1' });

    expect(res.status).toBe(201);
    expect(Competitor).toHaveBeenCalledWith({
      name: 'Created Competitor',
      category: 'Under 2 years',
      location: 'Ring 1',
    });
    expect(savedCompetitor.save).toHaveBeenCalledTimes(1);
    expect(res.body).toEqual(expect.objectContaining({
      name: 'Created Competitor',
      category: 'Under 2 years',
      location: 'Ring 1',
    }));
  });

  test('GET /api/judges does not expose password', async () => {
    const judges = [
      { _id: new mongoose.Types.ObjectId(), username: 'alice', isAdmin: false },
      { _id: new mongoose.Types.ObjectId(), username: 'bob', isAdmin: true },
    ];
    Judge.find.mockReturnValue(mockQuery(judges));

    const res = await request(app).get('/api/judges');

    expect(res.status).toBe(200);
    expect(Judge.find().select).toHaveBeenCalledWith('-password');
    expect(res.body).toHaveLength(2);
    expect(res.body[0].password).toBeUndefined();
    expect(res.body[1].password).toBeUndefined();
  });

  test('GET /api/categories/judge/:judgeId returns categories visible to that judge', async () => {
    const judgeId = new mongoose.Types.ObjectId().toString();
    const visibleCategories = [
      { _id: new mongoose.Types.ObjectId(), name: 'All Judges', visibleToJudges: [] },
      { _id: new mongoose.Types.ObjectId(), name: 'Specific Judge', visibleToJudges: [judgeId] },
    ];
    const query = mockQuery(visibleCategories);
    Category.find.mockReturnValue(query);

    const res = await request(app).get(`/api/categories/judge/${judgeId}`);

    expect(res.status).toBe(200);
    expect(Category.find).toHaveBeenCalledWith({
      $or: [
        { visibleToJudges: { $exists: false } },
        { visibleToJudges: { $size: 0 } },
        { visibleToJudges: judgeId },
      ],
    });
    expect(query.sort).toHaveBeenCalledWith({ name: 1 });
    expect(res.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'All Judges' }),
      expect.objectContaining({ name: 'Specific Judge' }),
    ]));
  });

  test('POST /api/assignments/save replaces all assignments with provided payload', async () => {
    const payload = [
      {
        judgeId: new mongoose.Types.ObjectId().toString(),
        competitorId: new mongoose.Types.ObjectId().toString(),
      },
      {
        judgeId: new mongoose.Types.ObjectId().toString(),
        competitorId: new mongoose.Types.ObjectId().toString(),
      },
    ];
    Assignment.deleteMany.mockResolvedValue({ deletedCount: 4 });
    Assignment.insertMany.mockResolvedValue(payload);

    const res = await request(app)
      .post('/api/assignments/save')
      .set('Authorization', `Bearer ${tokenFor({ isAdmin: true })}`)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'All assignments saved' });
    expect(Assignment.deleteMany).toHaveBeenCalledWith({});
    expect(Assignment.insertMany).toHaveBeenCalledWith(payload, { ordered: false });
  });

  test('POST /api/assignments/save clears assignments when payload is an empty array', async () => {
    Assignment.deleteMany.mockResolvedValue({ deletedCount: 2 });

    const res = await request(app)
      .post('/api/assignments/save')
      .set('Authorization', `Bearer ${tokenFor({ isAdmin: true })}`)
      .send([]);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'All assignments saved' });
    expect(Assignment.deleteMany).toHaveBeenCalledWith({});
    expect(Assignment.insertMany).not.toHaveBeenCalled();
  });

  test('POST /api/assignments/save rejects non-array payload', async () => {
    const res = await request(app)
      .post('/api/assignments/save')
      .set('Authorization', `Bearer ${tokenFor({ isAdmin: true })}`)
      .send({ judgeId: new mongoose.Types.ObjectId().toString(), competitorIds: [] });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: 'Invalid payload format' });
    expect(Assignment.deleteMany).not.toHaveBeenCalled();
    expect(Assignment.insertMany).not.toHaveBeenCalled();
  });

  test('POST /api/reviews upserts review with expected query, update, and options', async () => {
    const reviewPayload = {
      judgeId: new mongoose.Types.ObjectId().toString(),
      competitorId: new mongoose.Types.ObjectId().toString(),
      categoryId: new mongoose.Types.ObjectId().toString(),
      type: 'rating',
      value: '5',
    };
    const savedReview = { _id: new mongoose.Types.ObjectId(), ...reviewPayload };
    Review.findOneAndUpdate.mockResolvedValue(savedReview);

    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${tokenFor()}`)
      .send(reviewPayload);

    expect(res.status).toBe(200);
    expect(Review.findOneAndUpdate).toHaveBeenCalledWith(
      {
        judgeId: reviewPayload.judgeId,
        competitorId: reviewPayload.competitorId,
        categoryId: reviewPayload.categoryId,
      },
      reviewPayload,
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    expect(res.body).toEqual({ message: 'Review saved', review: expect.objectContaining(reviewPayload) });
  });

  test('POST /api/reviews rejects invalid payload with 400 before touching persistence', async () => {
    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${tokenFor()}`)
      .send({
        judgeId: new mongoose.Types.ObjectId().toString(),
        competitorId: new mongoose.Types.ObjectId().toString(),
        type: 'rating',
        value: '5',
      });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Missing required fields' });
    expect(Review.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('DELETE /api/competitors/:id cascades assignment and review deletes', async () => {
    const competitorId = new mongoose.Types.ObjectId().toString();
    Assignment.deleteMany.mockResolvedValue({ deletedCount: 2 });
    Review.deleteMany.mockResolvedValue({ deletedCount: 3 });
    Competitor.findByIdAndDelete.mockResolvedValue({ _id: competitorId });

    const res = await request(app)
      .delete(`/api/competitors/${competitorId}`)
      .set('Authorization', `Bearer ${tokenFor({ isAdmin: true })}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(Assignment.deleteMany).toHaveBeenCalledWith({ competitorId });
    expect(Review.deleteMany).toHaveBeenCalledWith({ competitorId });
    expect(Competitor.findByIdAndDelete).toHaveBeenCalledWith(competitorId);
  });

  test('DELETE /api/judges/:id cascades assignments, reviews, and category visibility cleanup', async () => {
    const judgeId = new mongoose.Types.ObjectId().toString();
    Assignment.deleteMany.mockResolvedValue({ deletedCount: 1 });
    Review.deleteMany.mockResolvedValue({ deletedCount: 2 });
    Category.updateMany.mockResolvedValue({ modifiedCount: 3 });
    Judge.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: judgeId, username: 'judge-one', isAdmin: false }),
    });
    Judge.findByIdAndDelete.mockResolvedValue({ _id: judgeId });

    const res = await request(app)
      .delete(`/api/judges/${judgeId}`)
      .set('Authorization', `Bearer ${tokenFor({ isAdmin: true })}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(Judge.findById).toHaveBeenCalledWith(judgeId);
    expect(Assignment.deleteMany).toHaveBeenCalledWith({ judgeId });
    expect(Review.deleteMany).toHaveBeenCalledWith({ judgeId });
    expect(Category.updateMany).toHaveBeenCalledWith({}, { $pull: { visibleToJudges: judgeId } });
    expect(Judge.findByIdAndDelete).toHaveBeenCalledWith(judgeId);
  });

  test('DELETE /api/judges/:id prevents deleting admin judge account', async () => {
    const judgeId = new mongoose.Types.ObjectId().toString();
    Judge.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: judgeId, username: 'admin', isAdmin: true }),
    });

    const res = await request(app)
      .delete(`/api/judges/${judgeId}`)
      .set('Authorization', `Bearer ${tokenFor({ isAdmin: true })}`);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: 'Admin account cannot be deleted' });
    expect(Assignment.deleteMany).not.toHaveBeenCalled();
    expect(Review.deleteMany).not.toHaveBeenCalled();
    expect(Category.updateMany).not.toHaveBeenCalled();
    expect(Judge.findByIdAndDelete).not.toHaveBeenCalled();
  });

  test('DELETE /api/categories/:id cascades review deletes', async () => {
    const categoryId = new mongoose.Types.ObjectId().toString();
    Review.deleteMany.mockResolvedValue({ deletedCount: 5 });
    Category.findByIdAndDelete.mockResolvedValue({ _id: categoryId });

    const res = await request(app)
      .delete(`/api/categories/${categoryId}`)
      .set('Authorization', `Bearer ${tokenFor({ isAdmin: true })}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(Review.deleteMany).toHaveBeenCalledWith({ categoryId });
    expect(Category.findByIdAndDelete).toHaveBeenCalledWith(categoryId);
  });

  test('GET /api/registration/access-config returns public style and active competition heats', async () => {
    const settings = {
      registrationOpen: true,
      managerPasswordHash: 'hash',
      publicStyle: 'classic-red',
    };
    const heats = [
      { _id: new mongoose.Types.ObjectId(), name: 'South Heat', active: true },
      { _id: new mongoose.Types.ObjectId(), name: 'Final', active: true },
    ];
    const heatQuery = { sort: jest.fn().mockResolvedValue(heats) };

    RegistrationSettings.findOne.mockResolvedValue(settings);
    RegistrationHeat.find.mockReturnValue(heatQuery);

    const res = await request(app).get('/api/registration/access-config');

    expect(res.status).toBe(200);
    expect(RegistrationHeat.find).toHaveBeenCalledWith({ active: true });
    expect(heatQuery.sort).toHaveBeenCalledWith({ order: 1, date: 1, name: 1 });
    expect(res.body).toEqual(expect.objectContaining({
      registrationOpen: true,
      passwordRequired: true,
      publicStyle: 'classic-red',
      heats: expect.arrayContaining([expect.objectContaining({ name: 'South Heat' })]),
    }));
  });

  test('PUT /api/admin/registration-settings allows admin to update public style', async () => {
    const settings = {
      registrationOpen: true,
      publicStyle: 'luxury',
      managerPasswordHash: 'hash',
      save: jest.fn().mockResolvedValue(undefined),
    };
    RegistrationSettings.findOne.mockResolvedValue(settings);

    const res = await request(app)
      .put('/api/admin/registration-settings')
      .set('Authorization', `Bearer ${tokenFor({ isAdmin: true, username: 'admin' })}`)
      .send({ publicStyle: 'classic-red', registrationOpen: false });

    expect(res.status).toBe(200);
    expect(settings.publicStyle).toBe('classic-red');
    expect(settings.registrationOpen).toBe(false);
    expect(settings.save).toHaveBeenCalledTimes(1);
    expect(res.body).toEqual(expect.objectContaining({
      registrationOpen: false,
      publicStyle: 'classic-red',
      hasManagerPassword: true,
    }));
  });

  test('DELETE /api/admin/registrations rejects missing typed DELETE confirmation', async () => {
    const res = await request(app)
      .delete('/api/admin/registrations')
      .set('Authorization', `Bearer ${tokenFor({ isAdmin: true })}`)
      .send({ confirm: 'WRONG' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: 'Type DELETE to confirm deleting all registrations' });
    expect(CompetitorRegistration.deleteMany).not.toHaveBeenCalled();
  });

  test('DELETE /api/admin/registrations deletes registrations only with typed DELETE confirmation', async () => {
    CompetitorRegistration.deleteMany.mockResolvedValue({ deletedCount: 3 });

    const res = await request(app)
      .delete('/api/admin/registrations')
      .set('Authorization', `Bearer ${tokenFor({ isAdmin: true })}`)
      .send({ confirm: 'DELETE' });

    expect(res.status).toBe(200);
    expect(CompetitorRegistration.deleteMany).toHaveBeenCalledWith({});
    expect(res.body).toEqual({ success: true, deletedCount: 3 });
  });

  test('POST /api/registration creates manager competitor registration without surname', async () => {
    const clubId = new mongoose.Types.ObjectId();
    const timingCategoryId = new mongoose.Types.ObjectId();
    const settings = {
      registrationOpen: true,
      publicStyle: 'classic-red',
      managerPasswordHash: 'hash',
    };
    const club = {
      _id: clubId,
      name: 'RWB',
      regionId: null,
      regionNameSnapshot: '',
    };
    const timingCategory = {
      _id: timingCategoryId,
      name: 'Chipping',
      active: true,
    };
    const savedRegistration = {
      _id: new mongoose.Types.ObjectId(),
      save: jest.fn().mockResolvedValue(undefined),
    };

    RegistrationSettings.findOne.mockResolvedValue(settings);
    Club.findOne.mockResolvedValue(club);
    RegistrationTimingCategory.find.mockResolvedValue([timingCategory]);
    CompetitorRegistration.mockImplementation(function CompetitorRegistrationMock(data) {
      Object.assign(savedRegistration, data);
      return savedRegistration;
    });

    const res = await request(app)
      .post('/api/registration')
      .set('X-Registration-Access', managerRegistrationToken())
      .send({
        name: '  Full Name  ',
        clubId: String(clubId),
        competitionCategory: 'Over 2 years',
        timings: [{ categoryId: String(timingCategoryId), value: '1:24:15' }],
      });

    expect(res.status).toBe(201);
    expect(Club.findOne).toHaveBeenCalledWith({ _id: String(clubId), active: true });
    expect(CompetitorRegistration).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Full Name',
      surname: '',
      clubId,
      clubNameSnapshot: 'RWB',
      competitionCategory: 'Over 2 years',
      timings: [expect.objectContaining({ categoryNameSnapshot: 'Chipping', value: '1:24:15' })],
    }));
    expect(savedRegistration.save).toHaveBeenCalledTimes(1);
    expect(res.body.success).toBe(true);
  });

  test('POST /api/admin/registrations/:id/accept creates competitor and marks registration accepted', async () => {
    const registrationId = new mongoose.Types.ObjectId().toString();
    const competitorId = new mongoose.Types.ObjectId();
    const registration = {
      _id: registrationId,
      name: 'Accepted Person',
      competitionCategory: 'Under 2 years',
      clubNameSnapshot: 'RWB',
      status: 'pending',
      acceptedCompetitorId: null,
      save: jest.fn().mockResolvedValue(undefined),
    };
    const competitor = {
      _id: competitorId,
      save: jest.fn().mockResolvedValue(undefined),
    };

    CompetitorRegistration.findById.mockResolvedValue(registration);
    Competitor.mockImplementation(function CompetitorMock(data) {
      Object.assign(competitor, data);
      return competitor;
    });

    const res = await request(app)
      .post(`/api/admin/registrations/${registrationId}/accept`)
      .set('Authorization', `Bearer ${tokenFor({ isAdmin: true, username: 'admin' })}`);

    expect(res.status).toBe(200);
    expect(Competitor).toHaveBeenCalledWith({
      name: 'Accepted Person',
      category: 'Under 2 years',
      location: 'RWB',
    });
    expect(competitor.save).toHaveBeenCalledTimes(1);
    expect(registration.status).toBe('accepted');
    expect(registration.acceptedCompetitorId).toBe(competitorId);
    expect(registration.reviewedBy).toBe('admin');
    expect(registration.save).toHaveBeenCalledTimes(1);
    expect(res.body.success).toBe(true);
  });

  test('POST /api/admin/registrations/:id/reject marks pending registration rejected', async () => {
    const registrationId = new mongoose.Types.ObjectId().toString();
    const registration = {
      _id: registrationId,
      status: 'pending',
      save: jest.fn().mockResolvedValue(undefined),
    };
    CompetitorRegistration.findById.mockResolvedValue(registration);

    const res = await request(app)
      .post(`/api/admin/registrations/${registrationId}/reject`)
      .set('Authorization', `Bearer ${tokenFor({ isAdmin: true, username: 'admin' })}`)
      .send({ reason: 'Not eligible' });

    expect(res.status).toBe(200);
    expect(registration.status).toBe('rejected');
    expect(registration.rejectionReason).toBe('Not eligible');
    expect(registration.reviewedBy).toBe('admin');
    expect(registration.save).toHaveBeenCalledTimes(1);
    expect(res.body.success).toBe(true);
  });

});
