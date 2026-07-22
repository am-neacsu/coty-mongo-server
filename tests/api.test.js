const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const Judge = require('../models/Judge');

jest.mock('../models/Judge');

function mockQuery(result) {
  return {
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockResolvedValue(result),
  };
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
});
