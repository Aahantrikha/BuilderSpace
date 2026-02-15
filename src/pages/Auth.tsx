import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Rocket, Mail, ArrowRight, Chrome, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/context/AuthContext';

export function Auth() {
  const navigate = useNavigate();
  const { login, signup, googleLogin, isAuthenticated, error, clearError } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement>(null);

  // Redirect if already authenticated
  if (isAuthenticated) {
    navigate('/dashboard');
    return null;
  }

  // Initialize Google Sign-In button
  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    
    if (!clientId || clientId === 'your-google-client-id-here') {
      return;
    }

    // Wait for Google script to load
    const initializeGoogle = () => {
      if (window.google && googleButtonRef.current) {
        try {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: handleGoogleResponse,
            auto_select: false,
          });

          window.google.accounts.id.renderButton(
            googleButtonRef.current,
            {
              theme: 'outline',
              size: 'large',
              width: googleButtonRef.current.offsetWidth,
              text: isSignUp ? 'signup_with' : 'signin_with',
              shape: 'rectangular',
              logo_alignment: 'left',
            }
          );
        } catch (error) {
          console.error('Error initializing Google Sign-In:', error);
        }
      }
    };

    // Check if script is already loaded
    if (window.google) {
      initializeGoogle();
    } else {
      // Wait for script to load
      const checkGoogle = setInterval(() => {
        if (window.google) {
          clearInterval(checkGoogle);
          initializeGoogle();
        }
      }, 100);

      // Cleanup
      return () => clearInterval(checkGoogle);
    }
  }, [isSignUp]);

  const handleGoogleResponse = async (response: any) => {
    try {
      setIsLoading(true);
      clearError();
      await googleLogin(response.credential);
      navigate('/onboarding');
    } catch (error: any) {
      console.error('Google login failed:', error);
      // Error will be shown via the error state from AuthContext
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email.trim() || !formData.password.trim()) return;
    if (isSignUp && !formData.name.trim()) return;
    
    try {
      setIsLoading(true);
      clearError();

      if (isSignUp) {
        await signup(formData.name, formData.email, formData.password);
      } else {
        await login(formData.email, formData.password);
      }
      
      navigate('/onboarding');
    } catch (error) {
      console.error('Auth error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) clearError();
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setFormData({ name: '', email: '', password: '' });
    clearError();
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center">
              <Rocket className="w-6 h-6 text-black" />
            </div>
            <span className="text-xl font-semibold text-white">CodeJam</span>
          </Link>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white mb-2">
              {isSignUp ? 'Create your account' : 'Welcome back'}
            </h1>
            <p className="text-white/60">
              {isSignUp 
                ? 'Join CodeJam to find your team and build your ideas'
                : 'Sign in to find your team and build your ideas'
              }
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Google Login */}
          <div ref={googleButtonRef} className="w-full mb-6" style={{ minHeight: '44px' }} />

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-card text-white/40">or</span>
            </div>
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              {isSignUp && (
                <div>
                  <label className="block text-sm text-white/70 mb-2">
                    Full name
                  </label>
                  <Input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="John Doe"
                    className="w-full bg-background border-border text-white px-4 py-6 rounded-xl placeholder:text-white/30"
                    required={isSignUp}
                  />
                </div>
              )}

              <div>
                <label className="block text-sm text-white/70 mb-2">
                  Email address
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                  <Input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="you@university.edu"
                    className="w-full bg-background border-border text-white pl-12 pr-4 py-6 rounded-xl placeholder:text-white/30"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-white/70 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder={isSignUp ? 'Create a strong password' : 'Enter your password'}
                    className="w-full bg-background border-border text-white px-4 pr-12 py-6 rounded-xl placeholder:text-white/30"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {isSignUp && (
                  <p className="text-xs text-white/40 mt-2">
                    Password must be at least 6 characters long
                  </p>
                )}
              </div>

              <Button
                type="submit"
                disabled={isLoading || !formData.email.trim() || !formData.password.trim() || (isSignUp && !formData.name.trim())}
                className="w-full bg-white text-black hover:bg-white/90 rounded-xl py-6 text-base font-medium disabled:opacity-50 disabled:bg-white/50"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                    {isSignUp ? 'Creating account...' : 'Signing in...'}
                  </div>
                ) : (
                  <>
                    {isSignUp ? 'Create account' : 'Sign in'}
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </form>

          {/* Toggle Mode */}
          <div className="mt-6 text-center">
            <button
              onClick={toggleMode}
              className="text-white/60 hover:text-white transition-colors text-sm"
            >
              {isSignUp 
                ? 'Already have an account? Sign in'
                : "Don't have an account? Sign up"
              }
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-white/40 mt-6">
          By {isSignUp ? 'creating an account' : 'signing in'}, you agree to our{' '}
          <a href="#" className="text-white/60 hover:text-white transition-colors">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="#" className="text-white/60 hover:text-white transition-colors">
            Privacy Policy
          </a>
        </p>
      </motion.div>
    </div>
  );
}


