import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Filter, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Navbar } from '@/components/Navbar';
import { StartupCard } from '@/components/StartupCard';
import { useNavigate } from 'react-router-dom';
import { apiService } from '@/services/api';

const stages = ['All', 'Idea', 'Prototype', 'Launched'];

export function Startups() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStage, setSelectedStage] = useState('All');
  const [startups, setStartups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStartups();
  }, []);

  const loadStartups = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getStartups();
      setStartups(response.startups);
    } catch (error: any) {
      setError(error.message || 'Failed to load startups');
    } finally {
      setLoading(false);
    }
  };

  const filteredStartups = startups.filter((startup) => {
    const matchesSearch =
      startup.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      startup.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      startup.skillsNeeded?.some((skill: string) =>
        skill.toLowerCase().includes(searchQuery.toLowerCase())
      );
    const matchesStage = selectedStage === 'All' || startup.stage === selectedStage;
    return matchesSearch && matchesStage;
  });

  return (
    <div className="min-h-screen bg-black">
      <Navbar />

      <main className="pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-10"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
                  Startups
                </h1>
                <p className="text-white/60">
                  Discover early-stage startups looking for team members.
                </p>
              </div>
              <Button
                onClick={() => navigate('/create')}
                className="bg-white text-black hover:bg-white/90 rounded-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Post Startup
              </Button>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search startups, skills..."
                  className="w-full bg-card border-border text-white pl-12 pr-4 py-3 rounded-xl placeholder:text-white/30"
                />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
                {stages.map((stage) => (
                  <button
                    key={stage}
                    onClick={() => setSelectedStage(stage)}
                    className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                      selectedStage === stage
                        ? 'bg-white text-black'
                        : 'bg-card border border-border text-white/70 hover:border-border-hover'
                    }`}
                  >
                    {stage}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Results */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-white/60 animate-spin" />
                <span className="ml-3 text-white/60">Loading startups...</span>
              </div>
            ) : error ? (
              <div className="text-center py-20">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Filter className="w-8 h-8 text-red-400" />
                </div>
                <h3 className="text-lg font-medium text-white mb-2">
                  Failed to load startups
                </h3>
                <p className="text-red-400 mb-4">{error}</p>
                <Button
                  onClick={loadStartups}
                  className="bg-white text-black hover:bg-white/90"
                >
                  Try Again
                </Button>
              </div>
            ) : filteredStartups.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredStartups.map((startup, index) => (
                  <StartupCard
                    key={startup.id}
                    startup={{
                      startup_id: startup.id,
                      startup_name: startup.name,
                      description: startup.description,
                      stage: startup.stage,
                      skills_needed: startup.skillsNeeded || [],
                      founder_name: startup.founder?.name || 'Unknown',
                      founder_avatar: startup.founder?.avatar,
                      created_at: new Date(startup.createdAt),
                    }}
                    index={index}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-20">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Filter className="w-8 h-8 text-white/30" />
                </div>
                <h3 className="text-lg font-medium text-white mb-2">
                  No startups found
                </h3>
                <p className="text-white/50">
                  {startups.length === 0 
                    ? 'Be the first to post a startup!' 
                    : 'Try adjusting your search or filters'
                  }
                </p>
                {startups.length === 0 && (
                  <Button
                    onClick={() => navigate('/create')}
                    className="mt-4 bg-white text-black hover:bg-white/90"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Startup
                  </Button>
                )}
              </div>
            )}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
