import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, User } from 'lucide-react';
import type { Startup } from '@/types';
import { SkillBadge } from './SkillBadge';
import { StageBadge } from './StageBadge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface StartupCardProps {
  startup: Startup;
  index?: number;
}

export function StartupCard({ startup, index = 0 }: StartupCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1, ease: [0.4, 0, 0.2, 1] }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
    >
      <Link to={`/startups/${startup.id}`}>
        <div className="group bg-card border border-border rounded-xl p-6 hover:border-border-hover transition-all duration-300 h-full flex flex-col">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <Avatar className="w-10 h-10 border border-border">
                <AvatarImage src={startup.logo || `https://api.dicebear.com/7.x/shapes/svg?seed=${startup.name}`} alt={startup.name} />
                <AvatarFallback className="bg-white/10 text-white">
                  <User className="w-5 h-5" />
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold text-white group-hover:text-white/80 transition-colors">
                  {startup.name}
                </h3>
                <p className="text-sm text-white/50">by {startup.founder?.name || 'Unknown'}</p>
              </div>
            </div>
            <StageBadge stage={startup.stage} />
          </div>

          {/* Description */}
          <p className="text-white/60 text-sm mb-4 line-clamp-2 flex-grow">
            {startup.description}
          </p>

          {/* Skills */}
          <div className="flex flex-wrap gap-2 mb-4">
            {startup.skillsNeeded.slice(0, 3).map((skill) => (
              <SkillBadge key={skill} skill={skill} variant="small" />
            ))}
            {startup.skillsNeeded.length > 3 && (
              <span className="text-xs text-white/40 px-2 py-0.5">
                +{startup.skillsNeeded.length - 3}
              </span>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <span className="text-xs text-white/40">
              {new Date(startup.createdAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}
            </span>
            <span className="flex items-center gap-1 text-sm text-white/70 group-hover:text-white transition-colors">
              View Details
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
