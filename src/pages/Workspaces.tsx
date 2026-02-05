import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, Plus, Loader2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/Navbar';
import { useAuth } from '@/context/AuthContext';
import { apiService } from '@/services/api';

interface Workspace {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  createdAt: string;
  memberCount?: number;
}

export function Workspaces() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWorkspaces();
  }, []);

  const loadWorkspaces = async () => {
    try {
      setLoading(true);
      const response = await apiService.getMyWorkspaces();
      // Backend returns 'spaces' not 'workspaces'
      setWorkspaces(response.spaces || []);
    } catch (error) {
      console.error('Failed to load workspaces:', error);
      setWorkspaces([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black">
      <Navbar />

      <main className="pt-24 pb-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Workspaces</h1>
              <p className="text-white/60">Your team collaboration spaces for startups and hackathons</p>
            </div>
          </motion.div>

          {/* Workspaces Grid */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-white/60 animate-spin" />
            </div>
          ) : workspaces.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-20"
            >
              <Users className="w-16 h-16 text-white/30 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">No workspaces yet</h2>
              <p className="text-white/50 mb-6">
                Workspaces are automatically created when you create a startup or hackathon team
              </p>
              <Button
                onClick={() => navigate('/create')}
                className="bg-white text-black hover:bg-white/90"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Startup or Team
              </Button>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {workspaces.map((workspace, index) => (
                <motion.div
                  key={workspace.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => navigate(`/workspaces/${workspace.id}`)}
                  className="bg-card border border-border rounded-xl p-6 cursor-pointer hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center">
                      <Users className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    {workspace.name}
                  </h3>
                  {workspace.description && (
                    <p className="text-sm text-white/50 mb-4 line-clamp-2">
                      {workspace.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/40">
                      {workspace.memberCount || 1} member{workspace.memberCount !== 1 ? 's' : ''}
                    </span>
                    <ArrowRight className="w-4 h-4 text-white/40" />
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
