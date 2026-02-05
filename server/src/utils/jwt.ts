import jwt from 'jsonwebtoken';

export const generateTokens = (userId: string, email: string) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not defined');
  }

  const accessToken = jwt.sign(
    { userId, email },
    secret,
    { expiresIn: '7d' }
  );

  const refreshToken = jwt.sign(
    { userId, email, type: 'refresh' },
    secret,
    { expiresIn: '30d' }
  );

  return { accessToken, refreshToken };
};

export const verifyToken = (token: string) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not defined');
  }
  return jwt.verify(token, secret);
};