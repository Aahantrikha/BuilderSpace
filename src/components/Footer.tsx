import { Link } from 'react-router-dom';
import { Rocket, Twitter, Github, Linkedin, Instagram } from 'lucide-react';

export function Footer() {
  const footerLinks = {
    Platform: [
      { name: 'Startups', href: '/startups' },
      { name: 'Hackathons', href: '/hackathons' },
      { name: 'Dashboard', href: '/dashboard' },
    ],
    Company: [
      { name: 'About', href: '#' },
      { name: 'Contact', href: '#' },
    ],
    Legal: [
      { name: 'Privacy', href: '#' },
      { name: 'Terms', href: '#' },
    ],
  };

  const socialLinks = [
    { name: 'Twitter', icon: Twitter, href: '#' },
    { name: 'GitHub', icon: Github, href: '#' },
    { name: 'LinkedIn', icon: Linkedin, href: '#' },
  ];

  return (
    <footer id="footer" className="bg-black border-t border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Main Footer Content */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          {/* Logo Column */}
          <div className="col-span-2">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
                <Rocket className="w-5 h-5 text-black" />
              </div>
              <span className="text-lg font-semibold text-white">CodeJam</span>
            </Link>
            <p className="text-sm text-white/50 mb-6 max-w-xs">
              Find your team. Build your idea. Connect with student builders on CodeJam.
            </p>
            {/* Social Links */}
            <div className="flex gap-3">
              {socialLinks.map((social) => (
                <a
                  key={social.name}
                  href={social.href}
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/5 text-white/50 hover:bg-white/10 hover:text-white transition-all duration-200"
                  aria-label={social.name}
                >
                  <social.icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Link Columns */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="text-sm font-semibold text-white mb-4">{category}</h3>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.name}>
                    <Link
                      to={link.href}
                      className="text-sm text-white/50 hover:text-white transition-colors duration-200"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-white/40">
            &copy; {new Date().getFullYear()} CodeJam. All rights reserved.
          </p>
          <div className="flex gap-6">
            <Link to="#" className="text-sm text-white/40 hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <Link to="#" className="text-sm text-white/40 hover:text-white transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
