import { useEffect, useRef } from 'react';

interface CodeSnippet {
  id: number;
  text: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  opacity: number;
  color: string;
}

const codeSnippets = [
  'const build = () => {}',
  'function collaborate()',
  '// Innovation starts here',
  'import { Team } from "builders"',
  'export default Startup',
  'async function launch()',
  '{ success: true }',
  'npm run build',
  'git commit -m "ship it"',
  'const team = await findCoFounder()',
  '01001000 01100101',
  'SELECT * FROM ideas',
  'while(building) { grow() }',
  '<BuilderSpace />',
  'return <Innovation />',
  'useEffect(() => {})',
  'interface Builder {}',
  'type Startup = {}',
  'let ideas = []',
  'const hackathon = new Event()',
];

export function AnimatedCodeBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const updateSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    updateSize();
    window.addEventListener('resize', updateSize);

    // Create code snippets with balanced left/right distribution
    const snippets: CodeSnippet[] = [];
    const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b'];
    
    for (let i = 0; i < 15; i++) {
      // Alternate between left and right halves
      const isLeftSide = i % 2 === 0;
      const x = isLeftSide 
        ? Math.random() * (canvas.width / 2) 
        : (canvas.width / 2) + Math.random() * (canvas.width / 2);
      
      snippets.push({
        id: i,
        text: codeSnippets[Math.floor(Math.random() * codeSnippets.length)],
        x,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        opacity: Math.random() * 0.4 + 0.3,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    // Animation loop
    let animationId: number;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      snippets.forEach((snippet) => {
        // Update position
        snippet.x += snippet.vx;
        snippet.y += snippet.vy;

        // Bounce off edges
        if (snippet.x < -100 || snippet.x > canvas.width + 100) {
          snippet.vx *= -1;
        }
        if (snippet.y < -50 || snippet.y > canvas.height + 50) {
          snippet.vy *= -1;
        }

        // Draw text
        ctx.save();
        ctx.globalAlpha = snippet.opacity;
        ctx.fillStyle = snippet.color;
        ctx.font = '14px "Fira Code", monospace';
        ctx.fillText(snippet.text, snippet.x, snippet.y);
        ctx.restore();
      });

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', updateSize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ opacity: 0.6 }}
    />
  );
}
