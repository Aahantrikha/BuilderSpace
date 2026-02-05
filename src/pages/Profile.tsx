import { useState } from 'react';
import { motion } from 'framer-motion';
import { User, MapPin, GraduationCap, Edit, Rocket, Trophy, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/Navbar';
import { SkillBadge } from '@/components/SkillBadge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/context/AuthContext';
import { mockStartups, mockHackathons, mockApplications } from '@/data/mockData';

export function Profile() {
  const { user, logout } = useAuth();
  // Tab state is managed by Tabs component
  useState('startups'); // default value

  if (!user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Please sign in</h1>
          <Button onClick={() => window.location.href = '/auth'}>
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  // Filter user's startups, hackathons, and applications
  const myStartups = mockStartups.filter((s) => s.founder_id === user.user_id);
  const myHackathons = mockHackathons.filter((h) => h.creator_id === user.user_id);
  const myApps = mockApplications.filter((a) => a.applicant_id === user.user_id);

  return (
    <div className="min-h-screen bg-black">
      <Navbar />

      <main className="pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Profile Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-card border border-border rounded-2xl p-8 mb-8"
          >
            <div className="flex flex-col sm:flex-row items-start gap-6">
              {/* Avatar */}
              <Avatar className="w-24 h-24 border-4 border-border">
                <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}`} alt={user.name} />
                <AvatarFallback className="bg-white/10 text-white text-2xl">
                  <User className="w-10 h-10" />
                </AvatarFallback>
              </Avatar>

              {/* Info */}
              <div className="flex-1">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">
                      {user.name}
                    </h1>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-white/50">
                      <div className="flex items-center gap-1">
                        <GraduationCap className="w-4 h-4" />
                        {user.college}
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {user.city}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="border-white/20 text-white hover:bg-white/10 rounded-full"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Profile
                  </Button>
                </div>

                {/* Bio */}
                {user.bio && (
                  <p className="text-white/70 mb-4">{user.bio}</p>
                )}

                {/* Skills */}
                <div className="flex flex-wrap gap-2">
                  {user.skills.map((skill) => (
                    <SkillBadge key={skill} skill={skill} variant="small" />
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Tabs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Tabs defaultValue="startups" className="w-full">
              <TabsList className="w-full bg-card border border-border rounded-xl p-1 mb-6">
                <TabsTrigger
                  value="startups"
                  className="flex-1 data-[state=active]:bg-white data-[state=active]:text-black rounded-lg py-3"
                >
                  <Rocket className="w-4 h-4 mr-2" />
                  My Startups
                </TabsTrigger>
                <TabsTrigger
                  value="hackathons"
                  className="flex-1 data-[state=active]:bg-white data-[state=active]:text-black rounded-lg py-3"
                >
                  <Trophy className="w-4 h-4 mr-2" />
                  My Hackathons
                </TabsTrigger>
                <TabsTrigger
                  value="applications"
                  className="flex-1 data-[state=active]:bg-white data-[state=active]:text-black rounded-lg py-3"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Applications
                </TabsTrigger>
              </TabsList>

              <TabsContent value="startups" className="mt-0">
                {myStartups.length > 0 ? (
                  <div className="space-y-4">
                    {myStartups.map((startup) => (
                      <div
                        key={startup.startup_id}
                        className="bg-card border border-border rounded-xl p-6"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-semibold text-white text-lg">
                            {startup.startup_name}
                          </h3>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${
                              startup.stage === 'Idea'
                                ? 'bg-yellow-500/20 text-yellow-400'
                                : startup.stage === 'Prototype'
                                ? 'bg-blue-500/20 text-blue-400'
                                : 'bg-green-500/20 text-green-400'
                            }`}
                          >
                            {startup.stage}
                          </span>
                        </div>
                        <p className="text-white/60 mb-4">{startup.description}</p>
                        <div className="flex flex-wrap gap-2">
                          {startup.skills_needed.map((skill) => (
                            <SkillBadge key={skill} skill={skill} variant="small" />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16 bg-card border border-border rounded-xl">
                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Rocket className="w-8 h-8 text-white/30" />
                    </div>
                    <h3 className="text-lg font-medium text-white mb-2">
                      No startups yet
                    </h3>
                    <p className="text-white/50 mb-4">
                      Create your first startup post to find team members
                    </p>
                    <Button
                      onClick={() => (window.location.href = '/create')}
                      className="bg-white text-black hover:bg-white/90"
                    >
                      Create Startup
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="hackathons" className="mt-0">
                {myHackathons.length > 0 ? (
                  <div className="space-y-4">
                    {myHackathons.map((hackathon) => (
                      <div
                        key={hackathon.hackathon_id}
                        className="bg-card border border-border rounded-xl p-6"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-semibold text-white text-lg">
                            {hackathon.hackathon_name}
                          </h3>
                          <span className="text-sm text-white/50">
                            Team of {hackathon.team_size}
                          </span>
                        </div>
                        <p className="text-white/60 mb-4">{hackathon.description}</p>
                        <div className="flex items-center justify-between">
                          <div className="flex flex-wrap gap-2">
                            {hackathon.skills_needed.map((skill) => (
                              <SkillBadge key={skill} skill={skill} variant="small" />
                            ))}
                          </div>
                          <span className="text-sm text-white/40">
                            Deadline: {new Date(hackathon.deadline).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16 bg-card border border-border rounded-xl">
                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Trophy className="w-8 h-8 text-white/30" />
                    </div>
                    <h3 className="text-lg font-medium text-white mb-2">
                      No hackathons yet
                    </h3>
                    <p className="text-white/50 mb-4">
                      Create your first hackathon to find participants
                    </p>
                    <Button
                      onClick={() => (window.location.href = '/create')}
                      className="bg-white text-black hover:bg-white/90"
                    >
                      Create Hackathon
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="applications" className="mt-0">
                {myApps.length > 0 ? (
                  <div className="space-y-4">
                    {myApps.map((application) => (
                      <div
                        key={application.application_id}
                        className="bg-card border border-border rounded-xl p-6"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="font-semibold text-white text-lg">
                              {application.post_name}
                            </h3>
                            <p className="text-sm text-white/50 capitalize">
                              {application.post_type}
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
                            {application.status.charAt(0).toUpperCase() +
                              application.status.slice(1)}
                          </span>
                        </div>
                        <p className="text-white/60 text-sm">{application.message}</p>
                        <p className="text-xs text-white/40 mt-4">
                          Applied on {new Date(application.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16 bg-card border border-border rounded-xl">
                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FileText className="w-8 h-8 text-white/30" />
                    </div>
                    <h3 className="text-lg font-medium text-white mb-2">
                      No applications yet
                    </h3>
                    <p className="text-white/50 mb-4">
                      Start applying to startups and hackathons
                    </p>
                    <Button
                      onClick={() => (window.location.href = '/startups')}
                      className="bg-white text-black hover:bg-white/90"
                    >
                      Browse Startups
                    </Button>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </motion.div>

          {/* Logout */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-10 text-center"
          >
            <Button
              variant="ghost"
              onClick={logout}
              className="text-white/40 hover:text-white/60"
            >
              Log Out
            </Button>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
