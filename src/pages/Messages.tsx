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
  lastMessage?: {
    content: string;
    createdAt: string;
    senderId: string;
  };
  unreadCount?: number;
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
      // Sort by most recent message
      const sortedChats = response.screeningChats.sort((a: ScreeningChat, b: ScreeningChat) => {
        const aTime = a.lastMessage?.createdAt || a.createdAt;
        const bTime = b.lastMessage?.createdAt || b.createdAt;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });
      setChats(sortedChats);
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
                const hasUnread = chat.unreadCount && chat.unreadCount > 0;
                
                return (
                  <motion.div
                    key={chat.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => navigate(`/screening-chats/${chat.id}`)}
                    className="bg-card border border-border rounded-xl p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center relative">
                        <MessageCircle className="w-6 h-6 text-white" />
                        {hasUnread && (
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-white text-black rounded-full flex items-center justify-center text-xs font-bold">
                            {chat.unreadCount}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className={`font-medium ${hasUnread ? 'text-white' : 'text-white/80'}`}>
                            {otherUser?.name || 'Unknown User'}
                          </h3>
                          {hasUnread && (
                            <span className="text-xs text-white/60 bg-white/10 px-2 py-0.5 rounded-full">
                              {chat.unreadCount} new
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-white/40 mb-1">
                          {chat.application?.post?.name || 'Screening Chat'}
                        </p>
                        {chat.lastMessage && (
                          <p className={`text-sm truncate ${hasUnread ? 'text-white/70 font-medium' : 'text-white/50'}`}>
                            {chat.lastMessage.senderId === user?.id ? 'You: ' : ''}
                            {chat.lastMessage.content}
                          </p>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-white/40 flex-shrink-0" />
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
