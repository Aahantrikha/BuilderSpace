import jwt from 'jsonwebtoken';

export const generateTokens = (userId: string, email: string) => {
  const accessToken = jwt.sign(
    { userId, email },
    process.env.JWT_SECRET!,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  const refreshToken = jwt.sign(
    { userId, email, type: 'refresh' },
    process.env.JWT_SECRET!,
    { expiresIn: '30d' }
  );

  return { accessToken, refreshToken };
};

export const verifyToken = (token: string) => {
  return jwt.verify(token, process.env.JWT_SECRET!);
};