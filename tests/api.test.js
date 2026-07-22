const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../app');
const Judge = require('../models/Judge');
const Competitor = require('../models/Competitor');
const Assignment = require('../models/Assignment');
const Review = require('../models/Review');

jest.mock('../models/Judge');
jest.mock('../models/Competitor');
jest.mock('../models/Assignment');
jest.mock('../models/Review');

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
});
