'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

type NodeType = 'roaster' | 'cafe' | 'supplier' | 'bean' | 'recipe' | 'user';

type GraphNode = {
  id: string;
  label: string;
  type: NodeType;
};

type GraphLink = { source: string; target: string };

const NODE_COLOR: Record<NodeType, string> = {
  roaster: '#FF3B4E',
  cafe: '#2F8FFF',
  supplier: '#2ECC71',
  bean: '#FFC107',
  recipe: '#B84BFF',
  user: '#00E5FF',
};

const LINK_GLOW = '#5FC8FF';

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

export function NetworkTab() {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);
  const [size, setSize] = useState({ width: 900, height: 600 });

  const [isFullscreen, setIsFullscreen] = useState(false);

  const tuneForces = () => {
    const fg = graphRef.current;
    if (!fg) return;
    fg.d3Force('charge')?.strength(-18);
    fg.d3Force('link')?.distance(14);
    fg.d3AlphaDecay(0.003);
    fg.d3VelocityDecay(0.15);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const load = async () => {
      const [roasters, cafes, suppliers, beans, recipes, profiles] = await Promise.all([
        supabase.from('roasters').select('id, name'),
        supabase.from('cafes').select('id, name, supplying_roaster_id'),
        supabase.from('suppliers').select('id, name'),
        supabase.from('beans').select('id, name, roaster_id, suggested_by'),
        supabase.from('recipes').select('id, bean_id, user_id'),
        supabase.from('profiles').select('id, full_name'),
      ]);

      const profileName = new Map((profiles.data ?? []).map((p) => [p.id, p.full_name || 'مستخدم']));
      const n: GraphNode[] = [];
      const l: GraphLink[] = [];
      const usedUsers = new Set<string>();

      for (const r of roasters.data ?? []) n.push({ id: `roaster-${r.id}`, label: r.name, type: 'roaster' });
      for (const s of suppliers.data ?? []) n.push({ id: `supplier-${s.id}`, label: s.name, type: 'supplier' });
      for (const c of cafes.data ?? []) {
        n.push({ id: `cafe-${c.id}`, label: c.name, type: 'cafe' });
        if (c.supplying_roaster_id) l.push({ source: `cafe-${c.id}`, target: `roaster-${c.supplying_roaster_id}` });
      }
      for (const b of beans.data ?? []) {
        n.push({ id: `bean-${b.id}`, label: b.name, type: 'bean' });
        l.push({ source: `bean-${b.id}`, target: `roaster-${b.roaster_id}` });
        if (b.suggested_by) usedUsers.add(b.suggested_by);
      }
      for (const rec of recipes.data ?? []) {
        n.push({ id: `recipe-${rec.id}`, label: '', type: 'recipe' });
        l.push({ source: `recipe-${rec.id}`, target: `bean-${rec.bean_id}` });
        if (rec.user_id) {
          l.push({ source: `recipe-${rec.id}`, target: `user-${rec.user_id}` });
          usedUsers.add(rec.user_id);
        }
      }
      for (const uid of usedUsers) {
        n.push({ id: `user-${uid}`, label: profileName.get(uid) ?? 'مستخدم', type: 'user' });
      }

      setNodes(n);
      setLinks(l);
      setLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    if (loading) return;
    const t = setTimeout(tuneForces, 100);
    return () => clearTimeout(t);
  }, [loading]);

  useEffect(() => {
    const update = () => {
      const fsActive = document.fullscreenElement === containerRef.current;
      setIsFullscreen(fsActive);
      if (fsActive) {
        setSize({ width: window.innerWidth, height: window.innerHeight });
      } else if (containerRef.current) {
        setSize({ width: containerRef.current.clientWidth, height: 620 });
      }
    };
    update();
    window.addEventListener('resize', update);
    document.addEventListener('fullscreenchange', update);
    return () => {
      window.removeEventListener('resize', update);
      document.removeEventListener('fullscreenchange', update);
    };
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
        <span className="text-xs text-stone">({nodes.length} عقدة)</span>
        <button
          onClick={toggleFullscreen}
          className="mr-auto rounded-full border border-latte bg-white px-3 py-1.5 text-xs font-medium text-coffee transition hover:border-coffee hover:bg-sand"
        >
          {isFullscreen ? 'تصغير' : 'ملء الشاشة'}
        </button>
      </div>

      <div
        ref={containerRef}
        className={
          isFullscreen
            ? 'bg-[#07070a]'
            : 'overflow-hidden rounded-2xl border border-latte bg-[#0b0a09] shadow-sm'
        }
      >
        {loading ? (
          <p className="p-6 text-sm text-stone">تحميل الشبكة...</p>
        ) : (
          <ForceGraph2D
            ref={graphRef}
            width={size.width}
            height={size.height}
            graphData={{ nodes: nodes.map((n) => ({ ...n })), links: links.map((l) => ({ ...l })) }}
            nodeId="id"
            nodeLabel="label"
            nodeColor={(n: any) => NODE_COLOR[n.type as NodeType]}
            nodeVal={(n: any) => NODE_SIZE[n.type as NodeType]}
            linkCanvasObjectMode={() => 'replace'}
            linkCanvasObject={(link: any, ctx: CanvasRenderingContext2D) => {
              const src = link.source;
              const tgt = link.target;
              if (typeof src !== 'object' || typeof tgt !== 'object') return;
              ctx.save();
              ctx.shadowColor = LINK_GLOW;
              ctx.shadowBlur = 8;
              ctx.strokeStyle = 'rgba(95,200,255,0.55)';
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(src.x, src.y);
              ctx.lineTo(tgt.x, tgt.y);
              ctx.stroke();
              ctx.restore();
            }}
            linkDirectionalParticles={2}
            linkDirectionalParticleWidth={2.2}
            linkDirectionalParticleSpeed={0.006}
            linkDirectionalParticleColor={() => '#dff5ff'}
            backgroundColor="#07070a"
            cooldownTime={Infinity}
            nodeCanvasObjectMode={() => 'replace'}
            nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
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

              if (node.label) {
                const fontSize = Math.max(9 / globalScale, 2.5);
                ctx.font = `${fontSize}px Cairo, sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.fillStyle = 'rgba(255,255,255,0.8)';
                ctx.fillText(node.label, node.x, node.y + r + 2);
              }
            }}
            onNodeDragEnd={(node: any) => {
              node.fx = node.x;
              node.fy = node.y;
            }}
          />
        )}
      </div>
    </div>
  );
}
