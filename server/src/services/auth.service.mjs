import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import config from '../config/env.mjs';
import { query } from '../config/database.mjs';

const SALT_ROUNDS = 10;

// Valid pre-computed bcrypt hash for timing-attack mitigation on nonexistent user logins
const DUMMY_HASH = '$2b$10$94QW1RfRKKORkGKMZWSJgerg5Q/oh45URki6nkwfUCCLDR6dcoCWC';

/**
 * Hash a plain-text password using bcrypt
 * @param {string} password
 * @returns {Promise<string>}
 */
export const hashPassword = async (password) => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

/**
 * Compare plain-text password with hashed password
 * @param {string} password
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
export const comparePassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

/**
 * Generate a signed JWT token for a user with explicit HS256 algorithm
 * @param {{ user_id: string, email: string, name: string }} user
 * @returns {string}
 */
export const generateToken = (user) => {
  return jwt.sign(
    {
      userId: user.user_id,
      email: user.email,
      name: user.name,
    },
    config.jwtSecret,
    {
      expiresIn: config.jwtExpiresIn,
      algorithm: 'HS256',
    }
  );
};

/**
 * Verify and decode a JWT token with strict HS256 algorithm restriction
 * @param {string} token
 * @returns {object}
 */
export const verifyToken = (token) => {
  return jwt.verify(token, config.jwtSecret, {
    algorithms: ['HS256'],
  });
};

/**
 * Register a new user with duplicate handling (both query and DB unique constraint)
 * @param {{ name: string, email: string, password: string }}
 * @returns {Promise<{ user_id: string, name: string, email: string, created_at: string }>}
 */
export const registerUser = async ({ name, email, password }) => {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedName = name.trim();

  // 1. Proactive check for existing user
  const existingUserRes = await query(
    'SELECT user_id FROM users WHERE LOWER(email) = LOWER($1)',
    [normalizedEmail]
  );

  if (existingUserRes.rows.length > 0) {
    const error = new Error('Email is already registered');
    error.code = 'VALIDATION_ERROR';
    error.statusCode = 400;
    throw error;
  }

  // 2. Hash password
  const passwordHash = await hashPassword(password);

  // 3. Persist new user in database with race-condition guard for PG error 23505
  try {
    const insertRes = await query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING user_id, name, email, created_at`,
      [normalizedName, normalizedEmail, passwordHash]
    );

    return insertRes.rows[0];
  } catch (err) {
    if (err.code === '23505') {
      const error = new Error('Email is already registered');
      error.code = 'VALIDATION_ERROR';
      error.statusCode = 400;
      throw error;
    }
    throw err;
  }
};

/**
 * Authenticate user credentials with timing-safe comparison
 * @param {{ email: string, password: string }}
 * @returns {Promise<{ token: string, user: { user_id: string, name: string, email: string } }>}
 */
export const loginUser = async ({ email, password }) => {
  const normalizedEmail = email.trim().toLowerCase();

  // 1. Fetch user by email
  const userRes = await query(
    'SELECT user_id, name, email, password_hash FROM users WHERE LOWER(email) = $1',
    [normalizedEmail]
  );

  const user = userRes.rows[0];

  // 2. Timing-safe comparison: always execute bcrypt.compare even if user does not exist
  const passwordToCompare = user ? user.password_hash : DUMMY_HASH;
  const isMatch = await comparePassword(password, passwordToCompare);

  if (!user || !isMatch) {
    const error = new Error('Invalid email or password');
    error.code = 'AUTHENTICATION_ERROR';
    error.statusCode = 401;
    throw error;
  }

  // 3. Generate token
  const token = generateToken(user);

  return {
    token,
    user: {
      user_id: user.user_id,
      name: user.name,
      email: user.email,
    },
  };
};

/**
 * Retrieve user profile by ID; returns 401 if user account was deleted
 * @param {string} userId
 * @returns {Promise<{ user_id: string, name: string, email: string, created_at: string, updated_at: string }>}
 */
export const getUserById = async (userId) => {
  const userRes = await query(
    'SELECT user_id, name, email, created_at, updated_at FROM users WHERE user_id = $1',
    [userId]
  );

  if (userRes.rows.length === 0) {
    const error = new Error('User account no longer exists');
    error.code = 'AUTHENTICATION_ERROR';
    error.statusCode = 401;
    throw error;
  }

  return userRes.rows[0];
};

export default {
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken,
  registerUser,
  loginUser,
  getUserById,
};
