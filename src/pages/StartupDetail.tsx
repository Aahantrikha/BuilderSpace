import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, User, Calendar, MapPin, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/Navbar';
import { ApplyModal } from '@/components/ApplyModal';
import { SkillBadge } from '@/components/SkillBadge';
import { StageBadge } from '@/components/StageBadge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { apiService } from '@/services/api';

export function StartupDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [startup, setStartup] = useState<any>(null);
  const [hasApplied, setHasApplied] = useState(false);
  const [isFounder, setIsFounder] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadStartup();
    }
  }, [id]);

  const loadStartup = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getStartup(id!);
      setStartup(response.startup);
      setHasApplied(response.hasApplied);
      setIsFounder(response.isFounder || false);
    } catch (error: any) {
      setError(error.message || 'Failed to load startup');
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
          <span className="ml-3 text-white/60">Loading startup...</span>
        </div>
      </div>
    );
  }

  if (error || !startup) {
    return (
      <div className="min-h-screen bg-black">
        <Navbar />
        <div className="pt-24 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white mb-2">
              {error || 'Startup not found'}
            </h1>
            <Button onClick={() => navigate('/startups')} variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Startups
            </Button>
          </div>
        </div>
      </div>
    );
  }

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
              onClick={() => navigate('/startups')}
              className="text-white/60 hover:text-white mb-6"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Startups
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
                  {startup.name}
                </h1>
                <StageBadge stage={startup.stage} />
              </div>
              <Button
                onClick={() => setIsApplyModalOpen(true)}
                disabled={hasApplied || isFounder}
                className={`rounded-full px-6 ${
                  isFounder
                    ? 'bg-blue-500/20 text-blue-400 cursor-not-allowed'
                    : hasApplied 
                    ? 'bg-green-500/20 text-green-400 cursor-not-allowed' 
                    : 'bg-white text-black hover:bg-white/90'
                }`}
              >
                {isFounder ? 'Your Startup' : hasApplied ? 'Applied' : 'Apply to Join'}
              </Button>
            </div>

            {/* Founder Info */}
            <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl mb-8">
              <Avatar className="w-14 h-14 border-2 border-border">
                <AvatarImage src={startup.founder?.avatar} alt={startup.founder?.name} />
                <AvatarFallback className="bg-white/10 text-white text-lg">
                  <User className="w-6 h-6" />
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm text-white/50 mb-1">Founded by</p>
                <p className="font-semibold text-white text-lg">{startup.founder?.name || 'Unknown'}</p>
                {startup.founder?.college && (
                  <p className="text-sm text-white/40">{startup.founder.college}</p>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-white mb-3">About</h2>
              <p className="text-white/70 leading-relaxed">{startup.description}</p>
            </div>

            {/* Skills Needed */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-white mb-3">Skills Needed</h2>
              <div className="flex flex-wrap gap-2">
                {startup.skillsNeeded?.map((skill: string) => (
                  <SkillBadge key={skill} skill={skill} />
                )) || <p className="text-white/50">No specific skills required</p>}
              </div>
            </div>

            {/* Meta Info */}
            <div className="flex flex-wrap gap-6 pt-6 border-t border-border">
              <div className="flex items-center gap-2 text-white/50">
                <Calendar className="w-5 h-5" />
                <span>Posted {new Date(startup.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-2 text-white/50">
                <MapPin className="w-5 h-5" />
                <span>Remote / On-campus</span>
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
          // Refresh the startup data to update hasApplied status
          loadStartup();
        }}
        postName={startup.name}
        postId={startup.id}
        postType="startup"
      />
    </div>
  );
}
