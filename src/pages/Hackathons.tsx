import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Filter, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Navbar } from '@/components/Navbar';
import { HackathonCard } from '@/components/HackathonCard';
import { useNavigate } from 'react-router-dom';
import { apiService } from '@/services/api';

export function Hackathons() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [hackathons, setHackathons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadHackathons();
  }, []);

  const loadHackathons = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getHackathons();
      setHackathons(response.hackathons);
    } catch (error: any) {
      setError(error.message || 'Failed to load hackathons');
    } finally {
      setLoading(false);
    }
  };

  const filteredHackathons = hackathons.filter((hackathon) => {
    const matchesSearch =
      hackathon.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      hackathon.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      hackathon.skillsNeeded?.some((skill: string) =>
        skill.toLowerCase().includes(searchQuery.toLowerCase())
      );
    return matchesSearch;
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
                  Hackathons
                </h1>
                <p className="text-white/60">
                  Find hackathons and coding competitions to participate in.
                </p>
              </div>
              <Button
                onClick={() => navigate('/create')}
                className="bg-white text-black hover:bg-white/90 rounded-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Post Hackathon
              </Button>
            </div>

            {/* Search */}
            <div className="relative max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search hackathons, skills..."
                className="w-full bg-card border-border text-white pl-12 pr-4 py-3 rounded-xl placeholder:text-white/30"
              />
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
                <span className="ml-3 text-white/60">Loading hackathons...</span>
              </div>
            ) : error ? (
              <div className="text-center py-20">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Filter className="w-8 h-8 text-red-400" />
                </div>
                <h3 className="text-lg font-medium text-white mb-2">
                  Failed to load hackathons
                </h3>
                <p className="text-red-400 mb-4">{error}</p>
                <Button
                  onClick={loadHackathons}
                  className="bg-white text-black hover:bg-white/90"
                >
                  Try Again
                </Button>
              </div>
            ) : filteredHackathons.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredHackathons.map((hackathon, index) => (
                  <HackathonCard
                    key={hackathon.id}
                    hackathon={{
                      hackathon_id: hackathon.id,
                      hackathon_name: hackathon.name,
                      description: hackathon.description,
                      team_size: hackathon.teamSize,
                      deadline: new Date(hackathon.deadline),
                      skills_needed: hackathon.skillsNeeded || [],
                      creator_name: hackathon.creator?.name || 'Unknown',
                      creator_avatar: hackathon.creator?.avatar,
                      created_at: new Date(hackathon.createdAt),
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
                  No hackathons found
                </h3>
                <p className="text-white/50">
                  {hackathons.length === 0 
                    ? 'Be the first to post a hackathon!' 
                    : 'Try adjusting your search'
                  }
                </p>
                {hackathons.length === 0 && (
                  <Button
                    onClick={() => navigate('/create')}
                    className="mt-4 bg-white text-black hover:bg-white/90"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Hackathon
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
