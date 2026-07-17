'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

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
  roaster: 7,
  cafe: 7,
  supplier: 7,
  bean: 5,
  recipe: 3,
  user: 4,
};

const LEGEND: { type: NodeType; label: string }[] = [
  { type: 'roaster', label: 'محمصة' },
  { type: 'cafe', label: 'كوفي شوب' },
  { type: 'supplier', label: 'مورّد' },
  { type: 'bean', label: 'محصول' },
  { type: 'recipe', label: 'وصفة' },
  { type: 'user', label: 'مستخدم' },
];

/** رسم تصميمي ثابت — مو مربوط ببيانات حية، يستقر بعد ثوانٍ ويتوقف
 * تماماً عن إعادة الحساب (عشان ما يثقل الصفحة مهما زاد عدد العقد). */
const NODE_COUNT = 300;

function buildStaticGraph() {
  const nodes = Array.from({ length: NODE_COUNT }, (_, i) => ({
    id: `n${i}`,
    type: TYPES[i % TYPES.length],
  }));
  const links = nodes.map((node, i) => {
    const targetIdx = (i + 1 + Math.floor(Math.random() * 3)) % NODE_COUNT;
    return { source: node.id, target: nodes[targetIdx].id };
  });
  return { nodes, links };
}

export function NetworkTab() {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);
  const [size, setSize] = useState({ width: 900, height: 600 });
  const graphData = useMemo(() => buildStaticGraph(), []);

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setSize({ width: containerRef.current.clientWidth, height: 620 });
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      const fg = graphRef.current;
      if (!fg) return;
      fg.d3Force('charge')?.strength(-45);
      fg.d3Force('link')?.distance(28);
    }, 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {LEGEND.map((item) => (
          <span key={item.type} className="flex items-center gap-1.5 text-xs text-mocha">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: NODE_COLOR[item.type] }}
            />
            {item.label}
          </span>
        ))}
        <span className="text-xs text-stone">({NODE_COUNT} عقدة)</span>
      </div>

      <div ref={containerRef} className="overflow-hidden rounded-2xl border border-latte bg-[#0b0a09] shadow-sm">
        <ForceGraph2D
          ref={graphRef}
          width={size.width}
          height={size.height}
          graphData={graphData}
          nodeId="id"
          nodeColor={(n: any) => NODE_COLOR[n.type as NodeType]}
          nodeVal={(n: any) => NODE_SIZE[n.type as NodeType]}
          linkColor={() => 'rgba(180,200,255,0.3)'}
          backgroundColor="#0b0a09"
          cooldownTicks={120}
          nodeCanvasObjectMode={() => 'replace'}
          nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D) => {
            const color = NODE_COLOR[node.type as NodeType];
            const r = NODE_SIZE[node.type as NodeType];

            ctx.save();
            ctx.shadowColor = color;
            ctx.shadowBlur = 18;
            ctx.beginPath();
            ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.restore();

            ctx.beginPath();
            ctx.arc(node.x, node.y, r * 0.45, 0, 2 * Math.PI);
            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            ctx.fill();
          }}
        />
      </div>
    </div>
  );
}
