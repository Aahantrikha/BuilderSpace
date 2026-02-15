import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Rocket, User, Plus, Trophy, Home, MessageCircle, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useScrollPosition } from '@/hooks/useScrollPosition';

export function Navbar() {
  const { isAuthenticated, logout } = useAuth();
  const { isScrolled, scrollDirection, scrollPosition } = useScrollPosition();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const isLandingPage = location.pathname === '/';
  const isAuthPage = location.pathname === '/auth';

  // Show navbar if: not scrolled, scrolling up, or not on landing page
  const showNavbar = !isLandingPage || scrollPosition < 100 || scrollDirection === 'up';

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const publicNavLinks = [
    { name: 'Product', href: '#features' },
    { name: 'Teams', href: '#how-it-works' },
    { name: 'Resources', href: '#resources' },
    { name: 'Community', href: '/auth' },
    { name: 'Support', href: 'mailto:support@codejam.com' },
  ];

  const privateNavLinks = [
    { name: 'Home', href: '/dashboard', icon: Home },
    { name: 'Startups', href: '/startups', icon: Rocket },
    { name: 'Hackathons', href: '/hackathons', icon: Trophy },
    { name: 'Workspaces', href: '/workspaces', icon: Users },
    { name: 'Profile', href: '/profile', icon: User },
  ];

  const navLinks = isAuthenticated ? privateNavLinks : publicNavLinks;

  if (isAuthPage) return null;

  return (
    <>
      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={{ 
          y: showNavbar ? 0 : -100, 
          opacity: showNavbar ? 1 : 0 
        }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled || !isLandingPage
            ? 'bg-black/50 backdrop-blur-md border-b border-white/10'
            : 'bg-transparent'
        }`}
        style={{
          backdropFilter: (isScrolled || !isLandingPage) ? 'blur(12px) saturate(180%)' : 'none',
          WebkitBackdropFilter: (isScrolled || !isLandingPage) ? 'blur(12px) saturate(180%)' : 'none',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
                <Rocket className="w-5 h-5 text-black" />
              </div>
              <span className="text-lg font-semibold text-white group-hover:opacity-80 transition-opacity">
                CodeJam
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => {
                if (link.href.startsWith('mailto:')) {
                  return (
                    <a
                      key={link.name}
                      href={link.href}
                      className="px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-all duration-200"
                    >
                      {link.name}
                    </a>
                  );
                }
                return (
                  <Link
                    key={link.name}
                    to={link.href}
                    className="px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-all duration-200"
                  >
                    {link.name}
                  </Link>
                );
              })}
            </nav>

            {/* Right Side Actions */}
            <div className="hidden md:flex items-center gap-3">
              {isAuthenticated ? (
                <>
                  <Button
                    onClick={() => navigate('/messages')}
                    variant="ghost"
                    className="text-white/70 hover:text-white hover:bg-white/10 rounded-full p-2"
                    title="Messages"
                  >
                    <MessageCircle className="w-5 h-5" />
                  </Button>
                  <Button
                    onClick={() => navigate('/create')}
                    className="bg-white text-black hover:bg-white/90 rounded-full px-4 py-2 text-sm font-medium flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Create Post
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={logout}
                    className="text-white/70 hover:text-white hover:bg-white/10"
                  >
                    Log Out
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    onClick={() => navigate('/auth')}
                    className="text-white/70 hover:text-white hover:bg-white/10"
                  >
                    Log In
                  </Button>
                  <Button
                    onClick={() => navigate('/auth')}
                    className="bg-white text-black hover:bg-white/90 rounded-full px-4 py-2 text-sm font-medium"
                  >
                    Sign Up
                  </Button>
                </>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-all"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </motion.header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="fixed inset-0 z-40 md:hidden"
          >
            <div className="absolute inset-0 bg-black/95 backdrop-blur-xl" />
            <div className="relative h-full flex flex-col pt-20 px-6">
              <nav className="flex flex-col gap-2">
                {navLinks.map((link, index) => (
                  <motion.div
                    key={link.name}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    {link.href.startsWith('mailto:') ? (
                      <a
                        href={link.href}
                        className="flex items-center gap-3 px-4 py-4 text-lg text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                      >
                        {link.name}
                      </a>
                    ) : (
                      <Link
                        to={link.href}
                        className="flex items-center gap-3 px-4 py-4 text-lg text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                      >
                        {link.name}
                      </Link>
                    )}
                  </motion.div>
                ))}
              </nav>

              <div className="mt-auto pb-8 flex flex-col gap-3">
                {isAuthenticated ? (
                  <>
                    <Button
                      onClick={() => navigate('/create')}
                      className="w-full bg-white text-black hover:bg-white/90 rounded-full py-3 text-base font-medium"
                    >
                      <Plus className="w-5 h-5 mr-2" />
                      Create Post
                    </Button>
                    <Button
                      variant="outline"
                      onClick={logout}
                      className="w-full border-white/20 text-white hover:bg-white/10 rounded-full py-3"
                    >
                      Log Out
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      onClick={() => navigate('/auth')}
                      className="w-full bg-white text-black hover:bg-white/90 rounded-full py-3 text-base font-medium"
                    >
                      Sign Up
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => navigate('/auth')}
                      className="w-full border-white/20 text-white hover:bg-white/10 rounded-full py-3"
                    >
                      Log In
                    </Button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
