import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Rocket, Users, Zap, Target, ChevronDown, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { AnimatedCodeBackground } from '@/components/AnimatedCodeBackground';

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] as const } },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 },
  },
};

const features = [
  {
    icon: Zap,
    title: 'Join in minutes',
    description: 'Browse startups and hackathons, find your perfect match, and apply with one click.',
  },
  {
    icon: Users,
    title: 'Meet serious builders',
    description: 'Connect with motivated students who are actually building things, not just talking.',
  },
  {
    icon: Target,
    title: 'Build real projects',
    description: 'Work on meaningful projects that add to your portfolio and advance your career.',
  },
  {
    icon: Rocket,
    title: 'Launch faster together',
    description: 'Find co-founders, teammates, and collaborators to bring your ideas to life.',
  },
];

const testimonials = [
  {
    quote: "BuilderSpace helped me find my co-founder. We're now building something amazing together.",
    author: 'Alex Chen',
    role: 'CS Student, Stanford',
    company: 'StudySync',
  },
  {
    quote: 'I joined a hackathon team through BuilderSpace and we won first place!',
    author: 'Maya Patel',
    role: 'Engineering Student, MIT',
    company: 'GreenTech Hackathon',
  },
  {
    quote: 'The quality of builders on this platform is incredible. Everyone is so motivated.',
    author: 'David Kim',
    role: 'Design Student, RISD',
    company: 'CampusCart',
  },
];

export function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-black relative">
      {/* Animated code background for entire page */}
      <div className="fixed inset-0 pointer-events-none">
        <AnimatedCodeBackground />
      </div>
      
      <Navbar />

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Enhanced background layers */}
        <div className="absolute inset-0 bg-gradient-to-b from-black via-black to-transparent" />
        
        {/* Animated gradient orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-green-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
        
        {/* Radial gradient overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white/5 via-transparent to-transparent" />
        
        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:100px_100px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_80%)]" />

        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center pt-20 pb-8">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {/* Badge */}
            <motion.div variants={fadeInUp} className="mb-4 sm:mb-6">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-white/5 border border-white/10 text-xs sm:text-sm text-white/70">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                BuilderSpace is live
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              variants={fadeInUp}
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white tracking-tight mb-4 sm:mb-6 leading-tight"
            >
              Find your team.
              <br />
              <span className="text-white/80">Build your idea.</span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              variants={fadeInUp}
              className="text-base sm:text-lg md:text-xl text-white/60 max-w-2xl mx-auto mb-8 sm:mb-10 px-2"
            >
              Connect with student builders, join startups, and participate in hackathons. 
              The platform where ambitious students find their perfect team.
            </motion.p>

            {/* CTAs */}
            <motion.div
              variants={fadeInUp}
              className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center mb-12 sm:mb-16 px-4"
            >
              <Button
                onClick={() => navigate('/auth')}
                className="bg-white text-black hover:bg-white/90 rounded-full px-6 py-5 sm:px-8 sm:py-6 text-sm sm:text-base font-medium w-full sm:w-auto"
              >
                Find a Team
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2" />
              </Button>
              <Button
                onClick={() => navigate('/auth')}
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10 rounded-full px-6 py-5 sm:px-8 sm:py-6 text-sm sm:text-base font-medium w-full sm:w-auto"
              >
                Create a Team
              </Button>
            </motion.div>

            {/* Stats */}
            <motion.div
              variants={fadeInUp}
              className="flex flex-wrap justify-center gap-6 sm:gap-8 md:gap-16 mb-16 sm:mb-20 px-4"
            >
              {[
                { value: '10K+', label: 'Students' },
                { value: '500+', label: 'Startups' },
                { value: '200+', label: 'Hackathons' },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-1">
                    {stat.value}
                  </div>
                  <div className="text-xs sm:text-sm text-white/50">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="flex flex-col items-center gap-2 text-white/40"
          >
            <span className="text-xs">Scroll to explore</span>
            <ChevronDown className="w-5 h-5" />
          </motion.div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 sm:py-24 md:py-32 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12 sm:mb-16"
          >
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3 sm:mb-4 px-4">
              Everything you need to build
            </h2>
            <p className="text-base sm:text-lg text-white/60 max-w-2xl mx-auto px-4">
              From finding teammates to launching products, we've got you covered.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="group bg-card border border-border rounded-xl p-6 sm:p-8 hover:border-border-hover transition-all duration-300"
              >
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/10 rounded-xl flex items-center justify-center mb-4 sm:mb-6 group-hover:bg-white/15 transition-colors">
                  <feature.icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-white mb-2 sm:mb-3">{feature.title}</h3>
                <p className="text-sm sm:text-base text-white/60 leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-16 sm:py-24 md:py-32 lg:py-40 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 sm:gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4 sm:mb-6">
                Create, collaborate,
                <br />
                and go live
              </h2>
              <p className="text-base sm:text-lg text-white/60 mb-6 sm:mb-8">
                Our platform makes it easy to find the right people and start building together.
              </p>

              <div className="space-y-4 sm:space-y-6">
                {[
                  { step: '01', title: 'Create your profile', desc: 'Showcase your skills and what you\'re looking for.' },
                  { step: '02', title: 'Browse opportunities', desc: 'Explore startups and hackathons that match your interests.' },
                  { step: '03', title: 'Connect and build', desc: 'Apply to join teams and start building together.' },
                ].map((item) => (
                  <div key={item.step} className="flex gap-3 sm:gap-4">
                    <span className="text-xs sm:text-sm font-mono text-white/30 pt-1">{item.step}</span>
                    <div>
                      <h4 className="font-semibold text-white mb-1 text-sm sm:text-base">{item.title}</h4>
                      <p className="text-xs sm:text-sm text-white/50">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="relative"
            >
              <div className="aspect-square bg-gradient-to-br from-white/10 to-transparent rounded-2xl border border-border p-8 flex items-center justify-center">
                <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
                  <div className="bg-card border border-border rounded-xl p-4">
                    <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center mb-3">
                      <Users className="w-4 h-4 text-green-400" />
                    </div>
                    <div className="text-2xl font-bold text-white">2.5K</div>
                    <div className="text-xs text-white/50">Active teams</div>
                  </div>
                  <div className="bg-card border border-border rounded-xl p-4">
                    <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center mb-3">
                      <Rocket className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="text-2xl font-bold text-white">150+</div>
                    <div className="text-xs text-white/50">Projects launched</div>
                  </div>
                  <div className="bg-card border border-border rounded-xl p-4 col-span-2">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm text-white/70">Success Rate</span>
                      <span className="text-sm font-semibold text-green-400">87%</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full w-[87%] bg-gradient-to-r from-green-400 to-green-500 rounded-full" />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-16 sm:py-24 md:py-32 lg:py-40 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12 sm:mb-16"
          >
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3 sm:mb-4 px-4">
              Loved by builders worldwide
            </h2>
            <p className="text-base sm:text-lg text-white/60 px-4">
              Hear from students who found their team on BuilderSpace.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={testimonial.author}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="bg-card border border-border rounded-xl p-5 sm:p-6"
              >
                <p className="text-sm sm:text-base text-white/80 mb-4 sm:mb-6 leading-relaxed">"{testimonial.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 bg-white/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-xs sm:text-sm font-semibold text-white">
                      {testimonial.author.split(' ').map(n => n[0]).join('')}
                    </span>
                  </div>
                  <div>
                    <div className="font-medium text-white text-sm sm:text-base">{testimonial.author}</div>
                    <div className="text-xs sm:text-sm text-white/50">{testimonial.role}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 sm:py-24 md:py-32 lg:py-40 relative">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4 sm:mb-6 px-4">
              Ready to start building?
            </h2>
            <p className="text-base sm:text-lg text-white/60 mb-8 sm:mb-10 max-w-xl mx-auto px-4">
              Join thousands of students who are already building the future together.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4">
              <Button
                onClick={() => navigate('/auth')}
                className="bg-white text-black hover:bg-white/90 rounded-full px-6 py-5 sm:px-8 sm:py-6 text-sm sm:text-base font-medium w-full sm:w-auto"
              >
                Get Started for Free
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2" />
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
