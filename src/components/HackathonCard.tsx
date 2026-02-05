import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Calendar, Users, User } from 'lucide-react';
import type { Hackathon } from '@/types';
import { SkillBadge } from './SkillBadge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface HackathonCardProps {
  hackathon: Hackathon;
  index?: number;
}

export function HackathonCard({ hackathon, index = 0 }: HackathonCardProps) {
  const daysLeft = Math.ceil(
    (new Date(hackathon.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1, ease: [0.4, 0, 0.2, 1] }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
    >
      <Link to={`/hackathons/${hackathon.hackathon_id}`}>
        <div className="group bg-card border border-border rounded-xl p-6 hover:border-border-hover transition-all duration-300 h-full flex flex-col">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <Avatar className="w-10 h-10 border border-border">
                <AvatarImage src={hackathon.creator_avatar} alt={hackathon.creator_name} />
                <AvatarFallback className="bg-white/10 text-white">
                  <User className="w-5 h-5" />
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold text-white group-hover:text-white/80 transition-colors">
                  {hackathon.hackathon_name}
                </h3>
                <p className="text-sm text-white/50">by {hackathon.creator_name}</p>
              </div>
            </div>
          </div>

          {/* Description */}
          <p className="text-white/60 text-sm mb-4 line-clamp-2 flex-grow">
            {hackathon.description}
          </p>

          {/* Meta Info */}
          <div className="flex items-center gap-4 mb-4 text-sm text-white/50">
            <div className="flex items-center gap-1.5">
              <Users className="w-4 h-4" />
              <span>Team of {hackathon.team_size}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              <span className={daysLeft <= 7 ? 'text-red-400' : ''}>
                {daysLeft > 0 ? `${daysLeft} days left` : 'Ended'}
              </span>
            </div>
          </div>

          {/* Skills */}
          <div className="flex flex-wrap gap-2 mb-4">
            {hackathon.skills_needed.slice(0, 3).map((skill) => (
              <SkillBadge key={skill} skill={skill} variant="small" />
            ))}
            {hackathon.skills_needed.length > 3 && (
              <span className="text-xs text-white/40 px-2 py-0.5">
                +{hackathon.skills_needed.length - 3}
              </span>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <span className="text-xs text-white/40">
              {new Date(hackathon.created_at).toLocaleDateString('en-US', {
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
