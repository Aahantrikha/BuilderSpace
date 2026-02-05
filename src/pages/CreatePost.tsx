import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Rocket, Trophy, ChevronRight, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import { Navbar } from '@/components/Navbar';
import { allSkills } from '@/data/mockData';
import { apiService } from '@/services/api';

const tabs = [
  { id: 'startup', label: 'Create Startup', icon: Rocket },
  { id: 'hackathon', label: 'Create a Team for Hackathon', icon: Trophy },
];

const stages = ['Idea', 'Prototype', 'Launched'];

export function CreatePost() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'startup' | 'hackathon'>('startup');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Startup form state
  const [startupForm, setStartupForm] = useState({
    name: '',
    description: '',
    stage: 'Idea' as 'Idea' | 'Prototype' | 'Launched',
    skills: [] as string[],
  });

  // Hackathon form state
  const [hackathonForm, setHackathonForm] = useState({
    name: '',
    description: '',
    teamSize: 4,
    deadline: undefined as Date | undefined,
    skills: [] as string[],
  });

  const handleSkillToggle = (skill: string, formType: 'startup' | 'hackathon') => {
    if (formType === 'startup') {
      setStartupForm((prev) => ({
        ...prev,
        skills: prev.skills.includes(skill)
          ? prev.skills.filter((s) => s !== skill)
          : [...prev.skills, skill],
      }));
    } else {
      setHackathonForm((prev) => ({
        ...prev,
        skills: prev.skills.includes(skill)
          ? prev.skills.filter((s) => s !== skill)
          : [...prev.skills, skill],
      }));
    }
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      setError(null);

      if (activeTab === 'startup') {
        await apiService.createStartup({
          name: startupForm.name,
          description: startupForm.description,
          stage: startupForm.stage,
          skillsNeeded: startupForm.skills,
        });
        navigate('/startups');
      } else {
        await apiService.createHackathon({
          name: hackathonForm.name,
          description: hackathonForm.description,
          teamSize: hackathonForm.teamSize,
          deadline: hackathonForm.deadline!,
          skillsNeeded: hackathonForm.skills,
        });
        navigate('/hackathons');
      }
    } catch (error: any) {
      setError(error.message || 'Failed to create post');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = () => {
    if (activeTab === 'startup') {
      return (
        startupForm.name &&
        startupForm.description &&
        startupForm.skills.length > 0
      );
    }
    return (
      hackathonForm.name &&
      hackathonForm.description &&
      hackathonForm.deadline &&
      hackathonForm.skills.length > 0
    );
  };

  return (
    <div className="min-h-screen bg-black">
      <Navbar />

      <main className="pt-24 pb-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
              Create Post
            </h1>
            <p className="text-white/60">
              Share your startup idea or create a team for hackathons.
            </p>
          </motion.div>

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3"
            >
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-red-400 text-sm">{error}</p>
            </motion.div>
          )}

          {/* Tabs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex gap-2 mb-8"
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as 'startup' | 'hackathon')}
                className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-medium transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-white text-black'
                    : 'bg-card border border-border text-white/70 hover:border-border-hover'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </button>
            ))}
          </motion.div>

          {/* Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="bg-card border border-border rounded-2xl p-8"
          >
            <AnimatePresence mode="wait">
              {activeTab === 'startup' ? (
                <motion.div
                  key="startup"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  <div>
                    <Label className="text-white/70 mb-2 block">Startup Name</Label>
                    <Input
                      value={startupForm.name}
                      onChange={(e) =>
                        setStartupForm((prev) => ({ ...prev, name: e.target.value }))
                      }
                      placeholder="e.g., StudySync"
                      className="bg-background border-border text-white placeholder:text-white/30"
                    />
                  </div>

                  <div>
                    <Label className="text-white/70 mb-2 block">Description</Label>
                    <Textarea
                      value={startupForm.description}
                      onChange={(e) =>
                        setStartupForm((prev) => ({ ...prev, description: e.target.value }))
                      }
                      placeholder="Describe your startup idea and what you're building..."
                      className="bg-background border-border text-white placeholder:text-white/30 min-h-[120px]"
                    />
                  </div>

                  <div>
                    <Label className="text-white/70 mb-2 block">Stage</Label>
                    <div className="flex gap-2 flex-wrap">
                      {stages.map((stage) => (
                        <button
                          key={stage}
                          onClick={() =>
                            setStartupForm((prev) => ({ ...prev, stage: stage as any }))
                          }
                          className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                            startupForm.stage === stage
                              ? 'bg-white text-black'
                              : 'bg-white/10 text-white/70 hover:bg-white/20'
                          }`}
                        >
                          {stage}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-white/70 mb-2 block">Skills Needed</Label>
                    <div className="flex flex-wrap gap-2 max-h-[200px] overflow-y-auto p-1">
                      {allSkills.map((skill) => (
                        <button
                          key={skill}
                          onClick={() => handleSkillToggle(skill, 'startup')}
                          className={`px-3 py-1.5 rounded-full text-sm transition-all duration-200 ${
                            startupForm.skills.includes(skill)
                              ? 'bg-white text-black'
                              : 'bg-white/10 text-white/70 hover:bg-white/20'
                          }`}
                        >
                          {skill}
                        </button>
                      ))}
                    </div>
                    <p className="text-sm text-white/50 mt-2">
                      Selected: {startupForm.skills.length} skills
                    </p>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="hackathon"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  <div>
                    <Label className="text-white/70 mb-2 block">Hackathon/Event Name</Label>
                    <Input
                      value={hackathonForm.name}
                      onChange={(e) =>
                        setHackathonForm((prev) => ({ ...prev, name: e.target.value }))
                      }
                      placeholder="e.g., AI for Climate Change Hackathon"
                      className="bg-background border-border text-white placeholder:text-white/30"
                    />
                  </div>

                  <div>
                    <Label className="text-white/70 mb-2 block">Description</Label>
                    <Textarea
                      value={hackathonForm.description}
                      onChange={(e) =>
                        setHackathonForm((prev) => ({ ...prev, description: e.target.value }))
                      }
                      placeholder="Creating a team for this hackathon. Describe the event, your idea, and what skills you need..."
                      className="bg-background border-border text-white placeholder:text-white/30 min-h-[120px]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-white/70 mb-2 block">Team Size Needed</Label>
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        value={hackathonForm.teamSize}
                        onChange={(e) =>
                          setHackathonForm((prev) => ({
                            ...prev,
                            teamSize: parseInt(e.target.value) || 1,
                          }))
                        }
                        className="bg-background border-border text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-white/70 mb-2 block">Event Deadline</Label>
                      <DatePicker
                        date={hackathonForm.deadline}
                        onDateChange={(date) =>
                          setHackathonForm((prev) => ({ ...prev, deadline: date }))
                        }
                        placeholder="Select event deadline"
                        className="w-full"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-white/70 mb-2 block">Skills Needed</Label>
                    <div className="flex flex-wrap gap-2 max-h-[200px] overflow-y-auto p-1">
                      {allSkills.map((skill) => (
                        <button
                          key={skill}
                          onClick={() => handleSkillToggle(skill, 'hackathon')}
                          className={`px-3 py-1.5 rounded-full text-sm transition-all duration-200 ${
                            hackathonForm.skills.includes(skill)
                              ? 'bg-white text-black'
                              : 'bg-white/10 text-white/70 hover:bg-white/20'
                          }`}
                        >
                          {skill}
                        </button>
                      ))}
                    </div>
                    <p className="text-sm text-white/50 mt-2">
                      Selected: {hackathonForm.skills.length} skills
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit Button */}
            <div className="mt-8 pt-6 border-t border-border">
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit() || isSubmitting}
                className="w-full bg-white text-black hover:bg-white/90 disabled:opacity-50 rounded-xl py-6"
              >
                {isSubmitting ? (
                  'Creating...'
                ) : (
                  <>
                    Create {activeTab === 'startup' ? 'Startup' : 'Team Request'}
                    <ChevronRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
