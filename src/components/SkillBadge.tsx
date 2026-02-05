import { motion } from 'framer-motion';

interface SkillBadgeProps {
  skill: string;
  variant?: 'default' | 'small';
}

export function SkillBadge({ skill, variant = 'default' }: SkillBadgeProps) {
  return (
    <motion.span
      whileHover={{ scale: 1.05 }}
      className={`inline-flex items-center bg-white/10 text-white/80 rounded-full font-medium ${
        variant === 'small' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm'
      }`}
    >
      {skill}
    </motion.span>
  );
}
