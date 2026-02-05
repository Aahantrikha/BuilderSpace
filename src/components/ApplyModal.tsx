import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { apiService } from '@/services/api';

interface ApplyModalProps {
  isOpen: boolean;
  onClose: () => void;
  postName: string;
  postId: string;
  postType: 'startup' | 'hackathon';
}

export function ApplyModal({ isOpen, onClose, postName, postId, postType }: ApplyModalProps) {
  const [message, setMessage] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!message.trim()) return;
    
    try {
      setIsSubmitting(true);
      setError(null);
      
      await apiService.applyToPost({
        postType,
        postId,
        message: message.trim(),
      });
      
      setIsSubmitted(true);
    } catch (error: any) {
      console.error('Application submission error:', error);
      setError(error.message || 'Failed to submit application');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    onClose();
    // Reset state after animation
    setTimeout(() => {
      setMessage('');
      setIsSubmitted(false);
      setError(null);
    }, 300);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-card border-border text-white max-w-md">
        <AnimatePresence mode="wait">
          {!isSubmitted ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <DialogHeader>
                <DialogTitle className="text-xl font-semibold text-white">
                  Apply to join {postName}
                </DialogTitle>
              </DialogHeader>

              {error && (
                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <div className="mt-6">
                <label className="block text-sm text-white/70 mb-2">
                  Why do you want to join?
                </label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us about your skills and why you're interested..."
                  className="bg-background border-border text-white placeholder:text-white/30 min-h-[120px] resize-none"
                />
              </div>

              <div className="mt-6 flex gap-3">
                <Button
                  variant="outline"
                  onClick={handleClose}
                  className="flex-1 border-white/20 text-white hover:bg-white/10"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!message.trim() || isSubmitting}
                  className="flex-1 bg-white text-black hover:bg-white/90 disabled:opacity-50"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Application'}
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="py-8 text-center"
            >
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                Application Submitted!
              </h3>
              <p className="text-white/60 mb-6">
                Your application has been sent. You'll hear back soon!
              </p>
              <Button
                onClick={handleClose}
                className="bg-white text-black hover:bg-white/90"
              >
                Got it
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
