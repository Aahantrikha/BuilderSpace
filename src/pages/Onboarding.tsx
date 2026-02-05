import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Rocket, Check, ChevronRight, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/context/AuthContext';
import { allSkills } from '@/data/mockData';

const steps = ['Basic Info', 'Skills', 'Preferences'];

export function Onboarding() {
  const navigate = useNavigate();
  const { updateUser, user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: user?.name || '',
    college: user?.college || '',
    city: user?.city || '',
    bio: user?.bio || '',
    skills: user?.skills || [],
    preferences: {
      joinStartup: user?.preferences?.joinStartup ?? true,
      buildStartup: user?.preferences?.buildStartup ?? false,
      joinHackathons: user?.preferences?.joinHackathons ?? true,
    },
  });

  const handleSkillToggle = (skill: string) => {
    setFormData((prev) => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter((s) => s !== skill)
        : [...prev.skills, skill],
    }));
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      
      if (user) {
        await updateUser({
          ...formData,
          onboardingCompleted: true,
        });
      }
      
      navigate('/dashboard');
    } catch (error) {
      console.error('Failed to update profile:', error);
      // Still navigate to dashboard even if update fails
      navigate('/dashboard');
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return formData.name && formData.college && formData.city;
      case 1:
        return formData.skills.length > 0;
      case 2:
        return true;
      default:
        return false;
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        className="w-full max-w-2xl"
      >
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center">
              <Rocket className="w-6 h-6 text-black" />
            </div>
            <span className="text-xl font-semibold text-white">BuilderSpace</span>
          </div>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl p-8">
          {/* Progress */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              {steps.map((step, index) => (
                <div key={step} className="flex items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      index <= currentStep
                        ? 'bg-white text-black'
                        : 'bg-white/10 text-white/50'
                    }`}
                  >
                    {index < currentStep ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      index + 1
                    )}
                  </div>
                  <span
                    className={`ml-2 text-sm hidden sm:block ${
                      index <= currentStep ? 'text-white' : 'text-white/50'
                    }`}
                  >
                    {step}
                  </span>
                  {index < steps.length - 1 && (
                    <div
                      className={`w-12 sm:w-20 h-0.5 mx-2 sm:mx-4 ${
                        index < currentStep ? 'bg-white' : 'bg-white/10'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Step Content */}
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {currentStep === 0 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">
                    Tell us about yourself
                  </h2>
                  <p className="text-white/60">
                    This helps us match you with the right opportunities.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label className="text-white/70 mb-2 block">Full Name</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, name: e.target.value }))
                      }
                      placeholder="John Doe"
                      className="bg-background border-border text-white placeholder:text-white/30"
                    />
                  </div>

                  <div>
                    <Label className="text-white/70 mb-2 block">College/University</Label>
                    <Input
                      value={formData.college}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, college: e.target.value }))
                      }
                      placeholder="Stanford University"
                      className="bg-background border-border text-white placeholder:text-white/30"
                    />
                  </div>

                  <div>
                    <Label className="text-white/70 mb-2 block">City</Label>
                    <Input
                      value={formData.city}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, city: e.target.value }))
                      }
                      placeholder="Palo Alto, CA"
                      className="bg-background border-border text-white placeholder:text-white/30"
                    />
                  </div>

                  <div>
                    <Label className="text-white/70 mb-2 block">Bio (optional)</Label>
                    <Textarea
                      value={formData.bio}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, bio: e.target.value }))
                      }
                      placeholder="Tell us a bit about yourself and what you're looking for..."
                      className="bg-background border-border text-white placeholder:text-white/30 min-h-[100px]"
                    />
                  </div>
                </div>
              </div>
            )}

            {currentStep === 1 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">
                    Select your skills
                  </h2>
                  <p className="text-white/60">
                    Choose the technologies and skills you bring to the table.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 max-h-[300px] overflow-y-auto p-1">
                  {allSkills.map((skill) => (
                    <button
                      key={skill}
                      onClick={() => handleSkillToggle(skill)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                        formData.skills.includes(skill)
                          ? 'bg-white text-black'
                          : 'bg-white/10 text-white/70 hover:bg-white/20'
                      }`}
                    >
                      {skill}
                    </button>
                  ))}
                </div>

                <p className="text-sm text-white/50">
                  Selected: {formData.skills.length} skills
                </p>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">
                    What are you looking for?
                  </h2>
                  <p className="text-white/60">
                    Select the opportunities you're interested in.
                  </p>
                </div>

                <div className="space-y-3">
                  {[
                    {
                      key: 'joinStartup',
                      title: 'Join a startup',
                      description: 'Find early-stage startups looking for team members',
                    },
                    {
                      key: 'buildStartup',
                      title: 'Build a startup',
                      description: 'Create your own startup and find co-founders',
                    },
                    {
                      key: 'joinHackathons',
                      title: 'Join hackathons',
                      description: 'Participate in hackathons and competitions',
                    },
                  ].map((option) => (
                    <button
                      key={option.key}
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          preferences: {
                            ...prev.preferences,
                            [option.key]: !prev.preferences[option.key as keyof typeof prev.preferences],
                          },
                        }))
                      }
                      className={`w-full p-4 rounded-xl border text-left transition-all duration-200 ${
                        formData.preferences[option.key as keyof typeof formData.preferences]
                          ? 'border-white bg-white/10'
                          : 'border-border hover:border-border-hover'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium text-white">{option.title}</h3>
                          <p className="text-sm text-white/50">{option.description}</p>
                        </div>
                        <div
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                            formData.preferences[option.key as keyof typeof formData.preferences]
                              ? 'border-white bg-white'
                              : 'border-white/30'
                          }`}
                        >
                          {formData.preferences[option.key as keyof typeof formData.preferences] && (
                            <Check className="w-4 h-4 text-black" />
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>

          {/* Navigation */}
          <div className="flex gap-3 mt-8">
            {currentStep > 0 && (
              <Button
                variant="outline"
                onClick={handleBack}
                className="flex-1 border-white/20 text-white hover:bg-white/10"
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            )}
            <Button
              onClick={handleNext}
              disabled={!canProceed() || isSubmitting}
              className="flex-1 bg-white text-black hover:bg-white/90 disabled:opacity-50"
            >
              {currentStep === steps.length - 1 ? (
                isSubmitting ? 'Saving...' : 'Complete Profile'
              ) : (
                <>
                  Next
                  <ChevronRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
