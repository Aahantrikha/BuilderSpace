import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, User, Calendar, Users, Clock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/Navbar';
import { ApplyModal } from '@/components/ApplyModal';
import { SkillBadge } from '@/components/SkillBadge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { apiService } from '@/services/api';

export function HackathonDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [hackathon, setHackathon] = useState<any>(null);
  const [hasApplied, setHasApplied] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadHackathon();
    }
  }, [id]);

  const loadHackathon = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getHackathon(id!);
      setHackathon(response.hackathon);
      setHasApplied(response.hasApplied);
      setIsCreator(response.isCreator || false);
    } catch (error: any) {
      setError(error.message || 'Failed to load hackathon');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black">
        <Navbar />
        <div className="pt-24 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-white/60 animate-spin" />
          <span className="ml-3 text-white/60">Loading hackathon...</span>
        </div>
      </div>
    );
  }

  if (error || !hackathon) {
    return (
      <div className="min-h-screen bg-black">
        <Navbar />
        <div className="pt-24 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white mb-2">
              {error || 'Hackathon not found'}
            </h1>
            <Button onClick={() => navigate('/hackathons')} variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Hackathons
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const daysLeft = Math.ceil(
    (new Date(hackathon.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div className="min-h-screen bg-black">
      <Navbar />

      <main className="pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Back Button */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Button
              variant="ghost"
              onClick={() => navigate('/hackathons')}
              className="text-white/60 hover:text-white mb-6"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Hackathons
            </Button>
          </motion.div>

          {/* Main Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-card border border-border rounded-2xl p-8"
          >
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">
                  {hackathon.name}
                </h1>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      daysLeft > 7
                        ? 'bg-green-500/20 text-green-400'
                        : daysLeft > 0
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}
                  >
                    {daysLeft > 0 ? `${daysLeft} days left` : 'Ended'}
                  </span>
                </div>
              </div>
              <Button
                onClick={() => setIsApplyModalOpen(true)}
                disabled={daysLeft <= 0 || hasApplied || isCreator}
                className={`rounded-full px-6 ${
                  isCreator
                    ? 'bg-blue-500/20 text-blue-400 cursor-not-allowed'
                    : hasApplied 
                    ? 'bg-green-500/20 text-green-400 cursor-not-allowed' 
                    : daysLeft <= 0
                    ? 'bg-gray-500/20 text-gray-400 cursor-not-allowed'
                    : 'bg-white text-black hover:bg-white/90'
                }`}
              >
                {isCreator ? 'Your Team' : hasApplied ? 'Applied' : daysLeft <= 0 ? 'Ended' : 'Apply to Join'}
              </Button>
            </div>

            {/* Creator Info */}
            <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl mb-8">
              <Avatar className="w-14 h-14 border-2 border-border">
                <AvatarImage src={hackathon.creator?.avatar} alt={hackathon.creator?.name} />
                <AvatarFallback className="bg-white/10 text-white text-lg">
                  <User className="w-6 h-6" />
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm text-white/50 mb-1">Organized by</p>
                <p className="font-semibold text-white text-lg">{hackathon.creator?.name || 'Unknown'}</p>
                {hackathon.creator?.college && (
                  <p className="text-sm text-white/40">{hackathon.creator.college}</p>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-white mb-3">About</h2>
              <p className="text-white/70 leading-relaxed">{hackathon.description}</p>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              <div className="bg-white/5 rounded-xl p-4">
                <div className="flex items-center gap-2 text-white/50 mb-2">
                  <Users className="w-5 h-5" />
                  <span>Team Size</span>
                </div>
                <p className="text-xl font-semibold text-white">{hackathon.teamSize} members</p>
              </div>
              <div className="bg-white/5 rounded-xl p-4">
                <div className="flex items-center gap-2 text-white/50 mb-2">
                  <Clock className="w-5 h-5" />
                  <span>Deadline</span>
                </div>
                <p className="text-xl font-semibold text-white">
                  {new Date(hackathon.deadline).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </div>

            {/* Skills Needed */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-white mb-3">Skills Needed</h2>
              <div className="flex flex-wrap gap-2">
                {hackathon.skillsNeeded?.map((skill: string) => (
                  <SkillBadge key={skill} skill={skill} />
                )) || <p className="text-white/50">No specific skills required</p>}
              </div>
            </div>

            {/* Meta Info */}
            <div className="flex flex-wrap gap-6 pt-6 border-t border-border">
              <div className="flex items-center gap-2 text-white/50">
                <Calendar className="w-5 h-5" />
                <span>Posted {new Date(hackathon.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Apply Modal */}
      <ApplyModal
        isOpen={isApplyModalOpen}
        onClose={() => {
          setIsApplyModalOpen(false);
          // Refresh the hackathon data to update hasApplied status
          loadHackathon();
        }}
        postName={hackathon.name}
        postId={hackathon.id}
        postType="hackathon"
      />
    </div>
  );
}
