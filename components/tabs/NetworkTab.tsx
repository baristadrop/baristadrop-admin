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

/** رقم ثابت 0..1 من نص (لكل عقدة نبضة/إيقاع خاص فيها مو متزامن مع البقية) */
function seed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000;
}

type Star = { x: number; y: number; r: number; phase: number; speed: number };

export function NetworkTab() {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);
  const [size, setSize] = useState({ width: 900, height: 600 });
  const [isFullscreen, setIsFullscreen] = useState(false);

  const hoveredIdRef = useRef<string | null>(null);
  const connectedRef = useRef<Set<string>>(new Set());
  const starsRef = useRef<Star[]>([]);

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

      starsRef.current = Array.from({ length: 120 }, () => ({
        x: Math.random(),
        y: Math.random(),
        r: 0.4 + Math.random() * 1.1,
        phase: Math.random() * Math.PI * 2,
        speed: 0.3 + Math.random() * 0.6,
      }));

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

  const isRelated = (id: string) => !hoveredIdRef.current || connectedRef.current.has(id);

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
            ? 'bg-[#050506]'
            : 'overflow-hidden rounded-2xl border border-latte bg-[#050506] shadow-sm'
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
            backgroundColor="#050506"
            cooldownTime={Infinity}
            onRenderFramePre={(ctx: CanvasRenderingContext2D) => {
              const t = Date.now() / 1000;
              for (const s of starsRef.current) {
                const alpha = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(t * s.speed + s.phase));
                ctx.beginPath();
                ctx.arc(s.x * size.width, s.y * size.height, s.r, 0, 2 * Math.PI);
                ctx.fillStyle = `rgba(210,225,255,${alpha.toFixed(3)})`;
                ctx.fill();
              }
            }}
            onNodeHover={(node: any) => {
              hoveredIdRef.current = node?.id ?? null;
              if (node) {
                const s = new Set<string>([node.id]);
                for (const l of links) {
                  if (l.source === node.id) s.add(l.target);
                  if (l.target === node.id) s.add(l.source);
                }
                connectedRef.current = s;
              } else {
                connectedRef.current = new Set();
              }
            }}
            linkCanvasObjectMode={() => 'replace'}
            linkCanvasObject={(link: any, ctx: CanvasRenderingContext2D) => {
              const src = link.source;
              const tgt = link.target;
              if (typeof src !== 'object' || typeof tgt !== 'object') return;
              const active = isRelated(src.id) && isRelated(tgt.id);
              const hot = hoveredIdRef.current && (src.id === hoveredIdRef.current || tgt.id === hoveredIdRef.current);

              ctx.save();
              ctx.shadowColor = LINK_GLOW;
              ctx.shadowBlur = hot ? 16 : 8;
              ctx.strokeStyle = hot
                ? 'rgba(150,225,255,0.95)'
                : active
                  ? 'rgba(95,200,255,0.55)'
                  : 'rgba(95,200,255,0.06)';
              ctx.lineWidth = hot ? 1.6 : 1;
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
            nodeCanvasObjectMode={() => 'replace'}
            nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
              const color = NODE_COLOR[node.type as NodeType];
              const baseR = NODE_SIZE[node.type as NodeType];
              const t = Date.now() / 1000;
              const off = seed(node.id) * 100;
              const pulse = 1 + 0.18 * Math.sin(t * 1.3 + off);
              const r = baseR * pulse;
              const related = isRelated(node.id);
              const dim = !related;

              ctx.save();
              if (dim) ctx.globalAlpha = 0.15;

              // bloom (تدرّج شعاعي)
              const bloom = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, r * 3.2);
              bloom.addColorStop(0, color + 'aa');
              bloom.addColorStop(0.5, color + '33');
              bloom.addColorStop(1, color + '00');
              ctx.beginPath();
              ctx.arc(node.x, node.y, r * 3.2, 0, 2 * Math.PI);
              ctx.fillStyle = bloom;
              ctx.fill();

              // نواة العقدة
              ctx.shadowColor = color;
              ctx.shadowBlur = related && hoveredIdRef.current ? 28 : 16;
              ctx.beginPath();
              ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
              ctx.fillStyle = color;
              ctx.fill();
              ctx.shadowBlur = 0;

              ctx.beginPath();
              ctx.arc(node.x, node.y, r * 0.42, 0, 2 * Math.PI);
              ctx.fillStyle = 'rgba(255,255,255,0.9)';
              ctx.fill();

              // نبضة رادار متمددة للخارج
              const cyclePos = ((t * 0.5 + off) % 3) / 3;
              ctx.beginPath();
              ctx.arc(node.x, node.y, r + cyclePos * 16, 0, 2 * Math.PI);
              ctx.strokeStyle = color + Math.round((1 - cyclePos) * 90).toString(16).padStart(2, '0');
              ctx.lineWidth = 1.2;
              ctx.stroke();

              if (node.label) {
                const fontSize = Math.max(9 / globalScale, 2.5);
                ctx.font = `${fontSize}px Cairo, sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.fillStyle = related ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.2)';
                ctx.fillText(node.label, node.x, node.y + r + 3);
              }
              ctx.restore();
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
