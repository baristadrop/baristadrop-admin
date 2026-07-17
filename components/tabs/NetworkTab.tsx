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
  roaster: '#A9793F',
  cafe: '#3B82F6',
  supplier: '#4C9A6A',
  bean: '#C9A876',
  recipe: '#7A6A57',
  user: '#E8E2D6',
};

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
    if (loading) return;
    const t = setTimeout(() => {
      const fg = graphRef.current;
      if (!fg) return;
      fg.d3Force('charge')?.strength(-45);
      fg.d3Force('link')?.distance(28);
    }, 50);
    return () => clearTimeout(t);
  }, [loading]);

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-latte bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-[var(--font-el-messiri)] text-xl text-ink">خريطة الشبكة</h2>
            <p className="mt-1 text-sm text-mocha">العلاقات الحقيقية بين المحامص والمحاصيل والوصفات والمستخدمين</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-latte bg-sand/40 px-4 py-2">
            <span className="text-xs text-mocha">إجمالي العُقَد</span>
            <span className="font-[var(--font-el-messiri)] text-lg text-ink">{nodes.length}</span>
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

      <div ref={containerRef} className="overflow-hidden rounded-2xl border border-latte bg-[#0b0a09] shadow-sm">
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
            linkColor={() => 'rgba(180,200,255,0.3)'}
            backgroundColor="#0b0a09"
            cooldownTicks={120}
            nodeCanvasObjectMode={() => 'replace'}
            nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
              const color = NODE_COLOR[node.type as NodeType];
              const r = NODE_SIZE[node.type as NodeType];

              // دائرة مسطحة بدون shadowBlur (مكلف على المعالج ويعيد حسابه
              // مع كل سحب/تكبير للشبكة، مو بس أول ما تفتح) — تدرّج خفيف
              // بدل الظل يعطي إحساس التوهج بتكلفة أقل بكثير.
              const grad = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, r);
              grad.addColorStop(0, 'rgba(255,255,255,0.9)');
              grad.addColorStop(0.35, color);
              grad.addColorStop(1, color);
              ctx.beginPath();
              ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
              ctx.fillStyle = grad;
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
