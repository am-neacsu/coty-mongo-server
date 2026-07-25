const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../app');
const Judge = require('../models/Judge');
const Competitor = require('../models/Competitor');
const Assignment = require('../models/Assignment');
const Review = require('../models/Review');
const Category = require('../models/Category');

jest.mock('../models/Judge');
jest.mock('../models/Competitor');
jest.mock('../models/Assignment');
jest.mock('../models/Review');
jest.mock('../models/Category');

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
    Judge.findByIdAndDelete.mockResolvedValue({ _id: judgeId });

    const res = await request(app)
      .delete(`/api/judges/${judgeId}`)
      .set('Authorization', `Bearer ${tokenFor({ isAdmin: true })}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(Assignment.deleteMany).toHaveBeenCalledWith({ judgeId });
    expect(Review.deleteMany).toHaveBeenCalledWith({ judgeId });
    expect(Category.updateMany).toHaveBeenCalledWith({}, { $pull: { visibleToJudges: judgeId } });
    expect(Judge.findByIdAndDelete).toHaveBeenCalledWith(judgeId);
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
});
