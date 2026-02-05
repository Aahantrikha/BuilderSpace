import { motion } from 'framer-motion';

interface StageBadgeProps {
  stage: 'Idea' | 'Prototype' | 'Launched';
}

const stageColors = {
  Idea: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  Prototype: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  Launched: 'bg-green-500/20 text-green-400 border-green-500/30',
};

export function StageBadge({ stage }: StageBadgeProps) {
  return (
    <motion.span
      whileHover={{ scale: 1.05 }}
      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${stageColors[stage]}`}
    >
      {stage}
    </motion.span>
  );
}
