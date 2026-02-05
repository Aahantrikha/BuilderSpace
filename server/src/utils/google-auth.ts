import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.FRONTEND_URL}/auth/google/callback`
);

export const verifyGoogleToken = async (token: string) => {
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      throw new Error('Invalid Google token');
    }

    return {
      googleId: payload.sub,
      email: payload.email!,
      name: payload.name!,
      avatar: payload.picture,
      emailVerified: payload.email_verified || false,
    };
  } catch (error) {
    console.error('Google token verification failed:', error);
    throw new Error('Invalid Google token');
  }
};

export const getGoogleAuthUrl = () => {
  const scopes = [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
  ];

  return client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    include_granted_scopes: true,
  });
};