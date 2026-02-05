import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MessageCircle, Loader2, ArrowRight } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { useAuth } from '@/context/AuthContext';
import { apiService } from '@/services/api';

interface ScreeningChat {
  id: string;
  applicationId: string;
  founderId: string;
  applicantId: string;
  createdAt: string;
  founder?: {
    id: string;
    name: string;
    email: string;
  };
  applicant?: {
    id: string;
    name: string;
    email: string;
  };
  application?: {
    post?: {
      name: string;
      postType: string;
    };
  };
}

export function Messages() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [chats, setChats] = useState<ScreeningChat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadChats();
  }, []);

  const loadChats = async () => {
    try {
      setLoading(true);
      const response = await apiService.getMyScreeningChats();
      setChats(response.screeningChats);
    } catch (error) {
      console.error('Failed to load chats:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black">
      <Navbar />

      <main className="pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-3xl font-bold text-white mb-2">Messages</h1>
            <p className="text-white/60">Your screening chats and conversations</p>
          </motion.div>

          {/* Chats List */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-white/60 animate-spin" />
            </div>
          ) : chats.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-20"
            >
              <MessageCircle className="w-16 h-16 text-white/30 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">No messages yet</h2>
              <p className="text-white/50 mb-6">
                When you accept applications, you'll be able to chat with applicants here.
              </p>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {chats.map((chat, index) => {
                const otherUser = user?.id === chat.founderId ? chat.applicant : chat.founder;
                return (
                  <motion.div
                    key={chat.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => navigate(`/screening-chats/${chat.id}`)}
                    className="bg-card border border-border rounded-xl p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center">
                        <MessageCircle className="w-6 h-6 text-white" />
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
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
