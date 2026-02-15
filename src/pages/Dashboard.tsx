import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Rocket, Trophy, Plus, ArrowRight, TrendingUp, Users, Calendar, Loader2, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/Navbar';
import { useAuth } from '@/context/AuthContext';
import { StartupCard } from '@/components/StartupCard';
import { HackathonCard } from '@/components/HackathonCard';
import { apiService } from '@/services/api';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useState, useEffect } from 'react';

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] as const } },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

export function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [startups, setStartups] = useState<any[]>([]);
  const [hackathons, setHackathons] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [receivedApplications, setReceivedApplications] = useState<any[]>([]);
  const [screeningChats, setScreeningChats] = useState<any[]>([]);
  const [stats, setStats] = useState({ users: 0, startups: 0, hackathons: 0, applications: 0 });
  const [loading, setLoading] = useState(true);

  // Connect to WebSocket for real-time stats updates
  const { lastMessage } = useWebSocket(user?.id || null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Listen for real-time stats updates
  useEffect(() => {
    if (lastMessage?.type === 'stats_update') {
      setStats(lastMessage.payload);
    }
  }, [lastMessage]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [startupsRes, hackathonsRes, applicationsRes, receivedRes, chatsRes, statsRes] = await Promise.all([
        apiService.getStartups({ limit: 3 }),
        apiService.getHackathons({ limit: 3 }),
        apiService.getMyApplications().catch(() => ({ applications: [] })), // Handle if user has no applications
        apiService.getReceivedApplications().catch(() => ({ applications: [] })), // Handle if user has no received applications
        apiService.getMyScreeningChats().catch(() => ({ screeningChats: [] })), // Handle if user has no chats
        apiService.getStats().catch(() => ({ stats: { users: 0, startups: 0, hackathons: 0, applications: 0 } })),
      ]);
      
      setStartups(startupsRes.startups);
      setHackathons(hackathonsRes.hackathons);
      setApplications(applicationsRes.applications);
      setReceivedApplications(receivedRes.applications);
      setScreeningChats(chatsRes.screeningChats);
      setStats(statsRes.stats);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApplicationStatus = async (applicationId: string, status: 'accepted' | 'rejected') => {
    try {
      console.log('Updating application status:', { applicationId, status });
      await apiService.updateApplicationStatus(applicationId, status);
      console.log('Application status updated successfully');
      
      // Reload received applications
      const receivedRes = await apiService.getReceivedApplications();
      setReceivedApplications(receivedRes.applications);
      console.log('Received applications reloaded');
    } catch (error) {
      console.error('Failed to update application status:', error);
    }
  };

  return (
    <div className="min-h-screen bg-black">
      <Navbar />

      <main className="pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Welcome Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-10"
          >
            <h1 className="text-3xl sm:text-4xl font-bold mb-2">
              <span className="bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent">
                Welcome back, {user?.name.split(' ')[0]}!
              </span>
            </h1>
            <p className="text-white/60">
              Here's what's happening in the CodeJam community.
            </p>
          </motion.div>

          {/* Stats Grid */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10"
          >
            {[
              { 
                icon: TrendingUp, 
                label: 'Startups', 
                value: loading ? '...' : `${stats.startups}`, 
                change: 'Active now',
                gradient: 'from-blue-500/20 to-cyan-500/20',
                iconBg: 'bg-blue-500/20',
                iconColor: 'text-blue-400'
              },
              { 
                icon: Trophy, 
                label: 'Hackathons', 
                value: loading ? '...' : `${stats.hackathons}`, 
                change: 'Upcoming',
                gradient: 'from-purple-500/20 to-pink-500/20',
                iconBg: 'bg-purple-500/20',
                iconColor: 'text-purple-400'
              },
              { 
                icon: Users, 
                label: 'Builders', 
                value: loading ? '...' : `${stats.users}`, 
                change: 'Total users',
                gradient: 'from-green-500/20 to-emerald-500/20',
                iconBg: 'bg-green-500/20',
                iconColor: 'text-green-400'
              },
              { 
                icon: Calendar, 
                label: 'Applications', 
                value: loading ? '...' : `${stats.applications}`, 
                change: 'Platform wide',
                gradient: 'from-orange-500/20 to-red-500/20',
                iconBg: 'bg-orange-500/20',
                iconColor: 'text-orange-400'
              },
            ].map((stat) => (
              <motion.div
                key={stat.label}
                variants={fadeInUp}
                whileHover={{ y: -4, scale: 1.02 }}
                className={`relative overflow-hidden bg-gradient-to-br ${stat.gradient} border border-white/10 rounded-2xl p-6 group cursor-pointer`}
              >
                {/* Animated background gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-12 h-12 ${stat.iconBg} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                      <stat.icon className={`w-6 h-6 ${stat.iconColor}`} />
                    </div>
                    <span className="text-xs text-white/40 font-medium">{stat.change}</span>
                  </div>
                  <div className="text-3xl font-bold text-white mb-1 group-hover:scale-105 transition-transform duration-300">{stat.value}</div>
                  <div className="text-sm text-white/60 font-medium">{stat.label}</div>
                </div>

                {/* Shine effect on hover */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex flex-wrap gap-3 mb-10"
          >
            <Button
              onClick={() => navigate('/startups')}
              className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-full px-6 py-6 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-300"
            >
              <Rocket className="w-4 h-4 mr-2" />
              Browse Startups
            </Button>
            <Button
              onClick={() => navigate('/hackathons')}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-full px-6 py-6 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all duration-300"
            >
              <Trophy className="w-4 h-4 mr-2" />
              Join Hackathon Teams
            </Button>
            <Button
              onClick={() => navigate('/create')}
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-full px-6 py-6 shadow-lg shadow-green-500/25 hover:shadow-green-500/40 transition-all duration-300"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Post
            </Button>
          </motion.div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-white/60 animate-spin" />
              <span className="ml-3 text-white/60">Loading dashboard...</span>
            </div>
          ) : (
            <>
              {/* Recent Startups */}
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="mb-12"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-white">Featured Startups</h2>
                  <Button
                    variant="ghost"
                    onClick={() => navigate('/startups')}
                    className="text-white/60 hover:text-white"
                  >
                    View all
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
                {startups.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {startups.map((startup, index) => (
                      <StartupCard 
                        key={startup.id} 
                        startup={{
                          id: startup.id,
                          founderId: startup.founderId,
                          name: startup.name,
                          description: startup.description,
                          stage: startup.stage,
                          skillsNeeded: startup.skillsNeeded || [],
                          createdAt: new Date(startup.createdAt),
                          founder: startup.founder ? {
                            id: startup.founder.id,
                            name: startup.founder.name,
                            avatar: startup.founder.avatar,
                            college: startup.founder.college,
                            city: startup.founder.city,
                            bio: startup.founder.bio,
                          } : undefined,
                        }} 
                        index={index} 
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-card border border-border rounded-xl">
                    <Rocket className="w-12 h-12 text-white/30 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-white mb-2">No startups yet</h3>
                    <p className="text-white/50 mb-4">Be the first to post a startup!</p>
                    <Button
                      onClick={() => navigate('/create')}
                      className="bg-white text-black hover:bg-white/90"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Create Startup
                    </Button>
                  </div>
                )}
              </motion.section>

              {/* Recent Hackathons */}
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="mb-12"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-white">Upcoming Hackathons</h2>
                  <Button
                    variant="ghost"
                    onClick={() => navigate('/hackathons')}
                    className="text-white/60 hover:text-white"
                  >
                    View all
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
                {hackathons.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {hackathons.map((hackathon, index) => (
                      <HackathonCard 
                        key={hackathon.id} 
                        hackathon={{
                          id: hackathon.id,
                          creatorId: hackathon.creatorId,
                          name: hackathon.name,
                          description: hackathon.description,
                          teamSize: hackathon.teamSize,
                          deadline: new Date(hackathon.deadline),
                          skillsNeeded: hackathon.skillsNeeded || [],
                          createdAt: new Date(hackathon.createdAt),
                          creator: hackathon.creator ? {
                            id: hackathon.creator.id,
                            name: hackathon.creator.name,
                            avatar: hackathon.creator.avatar,
                            college: hackathon.creator.college,
                            city: hackathon.creator.city,
                            bio: hackathon.creator.bio,
                          } : undefined,
                        }} 
                        index={index} 
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-card border border-border rounded-xl">
                    <Trophy className="w-12 h-12 text-white/30 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-white mb-2">No hackathon teams yet</h3>
                    <p className="text-white/50 mb-4">Be the first to create a team!</p>
                    <Button
                      onClick={() => navigate('/create')}
                      className="bg-white text-black hover:bg-white/90"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Create Team
                    </Button>
                  </div>
                )}
              </motion.section>

              {/* My Applications */}
              {applications.length > 0 && (
                <motion.section
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.5 }}
                  className="mb-12"
                >
                  <h2 className="text-xl font-semibold text-white mb-6">My Applications</h2>
                  <div className="space-y-3">
                    {applications.map((application) => (
                      <div
                        key={application.id}
                        className="bg-card border border-border rounded-xl p-4 flex items-center justify-between"
                      >
                        <div>
                          <h3 className="font-medium text-white">{application.post?.name || 'Unknown Post'}</h3>
                          <p className="text-sm text-white/50 capitalize">
                            {application.postType} • Applied{' '}
                            {new Date(application.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            application.status === 'accepted'
                              ? 'bg-green-500/20 text-green-400'
                              : application.status === 'rejected'
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-yellow-500/20 text-yellow-400'
                          }`}
                        >
                          {application.status.charAt(0).toUpperCase() + application.status.slice(1)}
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.section>
              )}

              {/* Received Applications */}
              {receivedApplications.length > 0 && (
                <motion.section
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.6 }}
                  className="mb-12"
                >
                  <h2 className="text-xl font-semibold text-white mb-6">Applications Received</h2>
                  <div className="space-y-4">
                    {receivedApplications.map((application) => (
                      <div
                        key={application.id}
                        className="bg-card border border-border rounded-xl p-6"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h3 className="font-medium text-white mb-1">
                              {application.applicant?.name || 'Unknown Applicant'}
                            </h3>
                            <p className="text-sm text-white/50">
                              Applied to {application.post?.name || 'Unknown Post'} • {' '}
                              {new Date(application.createdAt).toLocaleDateString()}
                            </p>
                            {application.applicant?.college && (
                              <p className="text-xs text-white/40 mt-1">
                                {application.applicant.college}
                              </p>
                            )}
                          </div>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${
                              application.status === 'accepted'
                                ? 'bg-green-500/20 text-green-400'
                                : application.status === 'rejected'
                                ? 'bg-red-500/20 text-red-400'
                                : 'bg-yellow-500/20 text-yellow-400'
                            }`}
                          >
                            {application.status.charAt(0).toUpperCase() + application.status.slice(1)}
                          </span>
                        </div>
                        
                        <div className="mb-4">
                          <p className="text-white/70 text-sm leading-relaxed">
                            {application.message}
                          </p>
                        </div>

                        {application.applicant?.skills && application.applicant.skills.length > 0 && (
                          <div className="mb-4">
                            <p className="text-xs text-white/50 mb-2">Skills:</p>
                            <div className="flex flex-wrap gap-1">
                              {application.applicant.skills.map((skill: string) => (
                                <span
                                  key={skill}
                                  className="px-2 py-1 bg-white/10 text-white/70 text-xs rounded-full"
                                >
                                  {skill}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {application.status === 'pending' && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                console.log('Accept button clicked for application:', application.id);
                                handleApplicationStatus(application.id, 'accepted');
                              }}
                              className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => {
                                console.log('Reject button clicked for application:', application.id);
                                handleApplicationStatus(application.id, 'rejected');
                              }}
                              className="px-3 py-1 border border-red-500/50 text-red-400 hover:bg-red-500/10 text-sm rounded"
                            >
                              Reject
                            </button>
                          </div>
                        )}

                        {application.status === 'accepted' && application.screeningChat && (
                          <button
                            onClick={() => navigate(`/screening-chats/${application.screeningChat.id}`)}
                            className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white text-sm rounded flex items-center gap-2"
                          >
                            <MessageCircle className="w-4 h-4" />
                            Open Chat
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </motion.section>
              )}

              {/* My Chats */}
              {screeningChats.length > 0 && (
                <motion.section
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.7 }}
                >
                  <h2 className="text-xl font-semibold text-white mb-6">My Chats</h2>
                  <div className="space-y-3">
                    {screeningChats.map((chat) => {
                      const otherUser = user?.id === chat.founderId ? chat.applicant : chat.founder;
                      return (
                        <div
                          key={chat.id}
                          onClick={() => navigate(`/screening-chats/${chat.id}`)}
                          className="bg-card border border-border rounded-xl p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center">
                              <MessageCircle className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <h3 className="font-medium text-white">
                                {otherUser?.name || 'Unknown User'}
                              </h3>
                              <p className="text-sm text-white/50">
                                {chat.application?.post?.name || 'Screening Chat'}
                              </p>
                            </div>
                          </div>
                          <ArrowRight className="w-5 h-5 text-white/40" />
                        </div>
                      );
                    })}
                  </div>
                </motion.section>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
