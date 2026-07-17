'use client';

import { useMemo } from 'react';

type NodeType = 'roaster' | 'cafe' | 'supplier' | 'bean' | 'recipe' | 'user';

const NODE_COLOR: Record<NodeType, string> = {
  roaster: '#A9793F',
  cafe: '#3B82F6',
  supplier: '#4C9A6A',
  bean: '#C9A876',
  recipe: '#7A6A57',
  user: '#E8E2D6',
};

const TYPES: NodeType[] = ['roaster', 'cafe', 'supplier', 'bean', 'recipe', 'user'];

const NODE_SIZE: Record<NodeType, number> = {
  roaster: 6,
  cafe: 6,
  supplier: 6,
  bean: 4.5,
  recipe: 3,
  user: 3.5,
};

const LEGEND: { type: NodeType; label: string }[] = [
  { type: 'roaster', label: 'محمصة' },
  { type: 'cafe', label: 'كوفي شوب' },
  { type: 'supplier', label: 'مورّد' },
  { type: 'bean', label: 'محصول' },
  { type: 'recipe', label: 'وصفة' },
  { type: 'user', label: 'مستخدم' },
];

const NODE_COUNT = 130;
const WIDTH = 1000;
const HEIGHT = 560;

/** توليد عشوائي بذرة ثابتة — نفس الشكل كل مرة، يحسب مرة وحدة فقط
 * (مو محاكاة فيزيائية حية) عشان ما يكون فيه أي حمل مستمر على المعالج. */
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function buildStaticLayout() {
  const rand = seededRandom(42);
  const nodes = Array.from({ length: NODE_COUNT }, (_, i) => {
    const type = TYPES[i % TYPES.length];
    return {
      id: i,
      type,
      x: 40 + rand() * (WIDTH - 80),
      y: 40 + rand() * (HEIGHT - 80),
      delay: rand() * 4,
    };
  });

  const links: { x1: number; y1: number; x2: number; y2: number }[] = [];
  nodes.forEach((node, i) => {
    const linkCount = 1 + Math.floor(rand() * 2);
    for (let k = 0; k < linkCount; k++) {
      const targetIdx = (i + 1 + Math.floor(rand() * 6)) % NODE_COUNT;
      const target = nodes[targetIdx];
      links.push({ x1: node.x, y1: node.y, x2: target.x, y2: target.y });
    }
  });

  return { nodes, links };
}

export function NetworkTab() {
  const { nodes, links } = useMemo(() => buildStaticLayout(), []);

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-latte bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-[var(--font-el-messiri)] text-xl text-ink">خريطة الشبكة</h2>
            <p className="mt-1 text-sm text-mocha">تصوّر بصري لترابط مجتمع Barista Drop</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-latte bg-sand/40 px-4 py-2">
            <span className="text-xs text-mocha">إجمالي العُقَد</span>
            <span className="font-[var(--font-el-messiri)] text-lg text-ink">{NODE_COUNT}</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2.5 border-t border-latte/70 pt-4 sm:grid-cols-3 lg:grid-cols-6">
          {LEGEND.map((item) => (
            <div key={item.type} className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: NODE_COLOR[item.type] }}
              />
              <span className="text-sm text-coffee">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-latte bg-[#0b0a09] shadow-sm">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full" style={{ display: 'block' }}>
          <defs>
            {TYPES.map((type) => (
              <radialGradient key={type} id={`glow-${type}`}>
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
                <stop offset="35%" stopColor={NODE_COLOR[type]} stopOpacity="1" />
                <stop offset="100%" stopColor={NODE_COLOR[type]} stopOpacity="1" />
              </radialGradient>
            ))}
          </defs>

          {links.map((link, i) => (
            <line
              key={i}
              x1={link.x1}
              y1={link.y1}
              x2={link.x2}
              y2={link.y2}
              stroke="rgba(180,200,255,0.25)"
              strokeWidth={1}
            />
          ))}

          {nodes.map((node) => (
            <circle
              key={node.id}
              cx={node.x}
              cy={node.y}
              r={NODE_SIZE[node.type]}
              fill={`url(#glow-${node.type})`}
              style={{
                animation: `barista-node-pulse 3.6s ease-in-out ${node.delay}s infinite`,
                transformOrigin: `${node.x}px ${node.y}px`,
              }}
            />
          ))}
        </svg>
      </div>

      <style>{`
        @keyframes barista-node-pulse {
          0%, 100% { opacity: 0.75; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.15); }
        }
      `}</style>
    </div>
  );
}
