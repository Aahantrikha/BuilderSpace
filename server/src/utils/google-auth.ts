import { OAuth2Client } from 'google-auth-library';

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const frontendUrl = process.env.FRONTEND_URL;

if (!googleClientId || !googleClientSecret || !frontendUrl) {
  console.warn('Google OAuth environment variables not set. Google authentication will be disabled.');
}

const client = googleClientId && googleClientSecret ? new OAuth2Client(
  googleClientId,
  googleClientSecret,
  `${frontendUrl}/auth/google/callback`
) : null;

export const verifyGoogleToken = async (token: string) => {
  if (!client) {
    throw new Error('Google OAuth is not configured');
  }
  
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: googleClientId,
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
  if (!client) {
    throw new Error('Google OAuth is not configured');
  }
  
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