import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, MessageCircle, Link as LinkIcon, CheckSquare, Send, Plus, Loader2, ArrowLeft, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/Navbar';
import { useAuth } from '@/context/AuthContext';
import { apiService } from '@/services/api';

export function WorkspaceDetail() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [workspace, setWorkspace] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'links' | 'tasks'>('chat');
  const [loading, setLoading] = useState(true);
  
  // Chat state
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  
  // Links state
  const [links, setLinks] = useState<any[]>([]);
  const [showAddLink, setShowAddLink] = useState(false);
  const [newLink, setNewLink] = useState({ title: '', url: '' });
  
  // Tasks state
  const [tasks, setTasks] = useState<any[]>([]);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', description: '' });

  useEffect(() => {
    if (workspaceId) {
      loadWorkspaceData();
    }
  }, [workspaceId]);

  const loadWorkspaceData = async () => {
    try {
      setLoading(true);
      const [workspaceRes, messagesRes, linksRes, tasksRes] = await Promise.all([
        apiService.getWorkspace(workspaceId!),
        apiService.getWorkspaceMessages(workspaceId!),
        apiService.getWorkspaceLinks(workspaceId!),
        apiService.getWorkspaceTasks(workspaceId!),
      ]);
      setWorkspace(workspaceRes.workspace);
      setMessages(messagesRes.messages || []);
      setLinks(linksRes.links || []);
      setTasks(tasksRes.tasks || []);
    } catch (error) {
      console.error('Failed to load workspace:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    try {
      setSending(true);
      const response = await apiService.sendWorkspaceMessage(workspaceId!, newMessage.trim());
      setMessages([...messages, response.message]);
      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLink.title.trim() || !newLink.url.trim()) return;

    try {
      const response = await apiService.addWorkspaceLink(workspaceId!, newLink);
      setLinks([...links, response.link]);
      setNewLink({ title: '', url: '' });
      setShowAddLink(false);
    } catch (error) {
      console.error('Failed to add link:', error);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title.trim()) return;

    try {
      const response = await apiService.createWorkspaceTask(workspaceId!, newTask);
      setTasks([...tasks, response.task]);
      setNewTask({ title: '', description: '' });
      setShowAddTask(false);
    } catch (error) {
      console.error('Failed to create task:', error);
    }
  };

  const handleToggleTask = async (taskId: string, completed: boolean) => {
    try {
      await apiService.updateWorkspaceTask(workspaceId!, taskId, { completed: !completed });
      setTasks(tasks.map(t => t.id === taskId ? { ...t, completed: !completed } : t));
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black">
        <Navbar />
        <div className="flex items-center justify-center h-[calc(100vh-80px)]">
          <Loader2 className="w-8 h-8 text-white/60 animate-spin" />
        </div>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="min-h-screen bg-black">
        <Navbar />
        <div className="flex flex-col items-center justify-center h-[calc(100vh-80px)]">
          <Users className="w-16 h-16 text-white/30 mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Workspace not found</h2>
          <Button onClick={() => navigate('/workspaces')} variant="outline">
            Back to Workspaces
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <Navbar />

      <main className="pt-20 pb-4 h-screen flex flex-col">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex-1 flex flex-col">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-xl p-4 mb-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/workspaces')}
                  className="text-white/60 hover:text-white"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <div>
                  <h1 className="text-lg font-semibold text-white">{workspace.name}</h1>
                  {workspace.description && (
                    <p className="text-sm text-white/50">{workspace.description}</p>
                  )}
                </div>
              </div>
              <Button
                onClick={() => navigate(`/workspaces/${workspaceId}/invite`)}
                className="bg-white text-black hover:bg-white/90 rounded-full"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Invite
              </Button>
            </div>
          </motion.div>

          {/* Tabs */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'chat'
                  ? 'bg-white text-black'
                  : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}
            >
              <MessageCircle className="w-4 h-4" />
              Chat
            </button>
            <button
              onClick={() => setActiveTab('links')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'links'
                  ? 'bg-white text-black'
                  : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}
            >
              <LinkIcon className="w-4 h-4" />
              Links
            </button>
            <button
              onClick={() => setActiveTab('tasks')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'tasks'
                  ? 'bg-white text-black'
                  : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}
            >
              <CheckSquare className="w-4 h-4" />
              Tasks
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 bg-card border border-border rounded-xl p-4 overflow-y-auto mb-4">
            {activeTab === 'chat' && (
              <div className="h-full flex flex-col">
                {messages.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-center">
                    <div>
                      <MessageCircle className="w-12 h-12 text-white/30 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-white mb-2">No messages yet</h3>
                      <p className="text-white/50">Start the conversation!</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 space-y-4 mb-4">
                    {messages.map((message) => {
                      const isOwn = message.senderId === user?.id;
                      return (
                        <div key={message.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                            isOwn ? 'bg-white text-black' : 'bg-white/10 text-white'
                          }`}>
                            {!isOwn && (
                              <p className="text-xs opacity-70 mb-1">{message.senderName}</p>
                            )}
                            <p className="text-sm leading-relaxed">{message.content}</p>
                            <p className={`text-xs mt-1 ${isOwn ? 'text-black/50' : 'text-white/50'}`}>
                              {new Date(message.createdAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'links' && (
              <div className="space-y-3">
                {links.length === 0 && !showAddLink ? (
                  <div className="text-center py-12">
                    <LinkIcon className="w-12 h-12 text-white/30 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-white mb-2">No links yet</h3>
                    <p className="text-white/50 mb-4">Share resources with your team</p>
                    <Button onClick={() => setShowAddLink(true)} className="bg-white text-black hover:bg-white/90">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Link
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold text-white">Shared Links</h3>
                      <Button onClick={() => setShowAddLink(true)} size="sm" className="bg-white text-black hover:bg-white/90">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Link
                      </Button>
                    </div>
                    {links.map((link) => (
                      <div key={link.id} className="bg-white/5 border border-white/10 rounded-lg p-4">
                        <h4 className="font-medium text-white mb-1">{link.title}</h4>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-400 hover:text-blue-300 break-all"
                        >
                          {link.url}
                        </a>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            {activeTab === 'tasks' && (
              <div className="space-y-3">
                {tasks.length === 0 && !showAddTask ? (
                  <div className="text-center py-12">
                    <CheckSquare className="w-12 h-12 text-white/30 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-white mb-2">No tasks yet</h3>
                    <p className="text-white/50 mb-4">Create tasks to track your work</p>
                    <Button onClick={() => setShowAddTask(true)} className="bg-white text-black hover:bg-white/90">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Task
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold text-white">Tasks</h3>
                      <Button onClick={() => setShowAddTask(true)} size="sm" className="bg-white text-black hover:bg-white/90">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Task
                      </Button>
                    </div>
                    {tasks.map((task) => (
                      <div key={task.id} className="bg-white/5 border border-white/10 rounded-lg p-4 flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={task.completed}
                          onChange={() => handleToggleTask(task.id, task.completed)}
                          className="mt-1 w-4 h-4 rounded border-white/20"
                        />
                        <div className="flex-1">
                          <h4 className={`font-medium ${task.completed ? 'text-white/50 line-through' : 'text-white'}`}>
                            {task.title}
                          </h4>
                          {task.description && (
                            <p className="text-sm text-white/50 mt-1">{task.description}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Input Area (only for chat) */}
          {activeTab === 'chat' && (
            <form onSubmit={handleSendMessage} className="bg-card border border-border rounded-xl p-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
                  disabled={sending}
                />
                <Button
                  type="submit"
                  disabled={!newMessage.trim() || sending}
                  className="bg-white text-black hover:bg-white/90"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </form>
          )}
        </div>
      </main>

      {/* Add Link Modal */}
      {showAddLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border rounded-xl p-6 w-full max-w-md"
          >
            <h2 className="text-xl font-semibold text-white mb-4">Add Link</h2>
            <form onSubmit={handleAddLink} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Title *</label>
                <input
                  type="text"
                  value={newLink.title}
                  onChange={(e) => setNewLink({ ...newLink, title: e.target.value })}
                  placeholder="GitHub Repository"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">URL *</label>
                <input
                  type="url"
                  value={newLink.url}
                  onChange={(e) => setNewLink({ ...newLink, url: e.target.value })}
                  placeholder="https://github.com/..."
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
                  required
                />
              </div>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowAddLink(false);
                    setNewLink({ title: '', url: '' });
                  }}
                  className="flex-1 border-white/20 text-white hover:bg-white/10"
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1 bg-white text-black hover:bg-white/90">
                  Add Link
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Add Task Modal */}
      {showAddTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border rounded-xl p-6 w-full max-w-md"
          >
            <h2 className="text-xl font-semibold text-white mb-4">Add Task</h2>
            <form onSubmit={handleAddTask} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Title *</label>
                <input
                  type="text"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  placeholder="Setup development environment"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Description (optional)</label>
                <textarea
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  placeholder="Install dependencies, configure environment..."
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/20 resize-none"
                />
              </div>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowAddTask(false);
                    setNewTask({ title: '', description: '' });
                  }}
                  className="flex-1 border-white/20 text-white hover:bg-white/10"
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1 bg-white text-black hover:bg-white/90">
                  Add Task
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
