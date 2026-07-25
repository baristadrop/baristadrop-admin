'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { DirhamIcon } from '@/components/icons/DirhamIcon';

type ProductCategory = 'cups' | 'clean' | 'tools' | 'subscription';

type ProductRow = {
  id: string;
  name: string;
  category: ProductCategory | null;
  price: number;
  description: string | null;
  image_url: string | null;
  external_url: string | null;
  is_active: boolean;
  status: 'pending' | 'approved' | 'rejected';
  supplier_id: string | null;
  cafe_id: string | null;
  roaster_id: string | null;
  supplier: { name: string } | null;
  cafe: { name: string } | null;
  roaster: { name: string } | null;
};

const CATEGORY_LABEL: Record<ProductCategory, string> = {
  cups: 'أكواب سيراميك',
  clean: 'تنظيف xBloom',
  tools: 'فلاتر وموازين',
  subscription: 'الاشتراكات',
};

const CATEGORIES = Object.keys(CATEGORY_LABEL) as ProductCategory[];

const STATUS_LABEL: Record<ProductRow['status'], string> = {
  pending: 'بانتظار المراجعة',
  approved: 'مقبول ✓',
  rejected: 'مرفوض',
};

function ownerLabel(p: ProductRow): string {
  if (p.supplier) return `مورّد: ${p.supplier.name}`;
  if (p.cafe) return `كوفي شوب: ${p.cafe.name}`;
  if (p.roaster) return `محمصة: ${p.roaster.name}`;
  return 'باريستا دروب';
}

async function uploadImage(file: File): Promise<string | null> {
  const ext = file.name.split('.').pop();
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('product-images').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) {
    alert('فشل رفع الصورة: ' + error.message);
    return null;
  }
  const { data } = supabase.storage.from('product-images').getPublicUrl(path);
  return data.publicUrl;
}

function NewProductForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ProductCategory>('cups');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    const url = await uploadImage(file);
    if (url) setImageUrl(url);
    setUploading(false);
  };

  const reset = () => {
    setName('');
    setCategory('cups');
    setPrice('');
    setDescription('');
    setImageUrl(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const canSubmit = name.trim().length > 0 && price.trim().length > 0 && !uploading;

  const submit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    const { error } = await supabase.from('products').insert({
      name: name.trim(),
      category,
      price: Number(price),
      description: description.trim() || null,
      image_url: imageUrl,
      is_active: true,
    });
    setSubmitting(false);
    if (error) {
      alert('صار خطأ: ' + error.message);
      return;
    }
    reset();
    onCreated();
  };

  return (
    <div className="rounded-2xl border border-latte bg-white p-5 shadow-sm">
      <h3 className="mb-4 font-medium text-ink">إضافة منتج جديد (باريستا دروب)</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-mocha">اسم المنتج</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="كوب سيراميك بارستا دروب"
            className="w-full rounded-lg border border-latte bg-paper px-3 py-2 text-sm outline-none focus:border-gold"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-mocha">التصنيف</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as ProductCategory)}
            className="w-full rounded-lg border border-latte bg-paper px-3 py-2 text-sm outline-none focus:border-gold"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 flex items-center gap-1 text-xs text-mocha">
            السعر (<DirhamIcon />)
          </label>
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            type="number"
            step="0.01"
            dir="ltr"
            placeholder="45"
            className="w-full rounded-lg border border-latte bg-paper px-3 py-2 text-sm outline-none focus:border-gold"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-mocha">صورة المنتج</label>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={(e) => handleFile(e.target.files?.[0])}
            className="w-full rounded-lg border border-latte bg-paper px-3 py-1.5 text-xs outline-none file:mr-2 file:rounded-md file:border-0 file:bg-sand file:px-2 file:py-1 file:text-xs"
          />
          {uploading && <p className="mt-1 text-xs text-mocha">جاري الرفع...</p>}
          {imageUrl && !uploading && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="mt-2 h-16 w-16 rounded-lg object-cover" />
          )}
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs text-mocha">الوصف (اختياري)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-latte bg-paper px-3 py-2 text-sm outline-none focus:border-gold"
          />
        </div>
      </div>
      <button
        onClick={submit}
        disabled={!canSubmit || submitting}
        className="mt-4 rounded-full bg-ink px-5 py-2 text-sm font-medium text-cream disabled:opacity-40"
      >
        {submitting ? 'جاري الإضافة...' : 'إضافة المنتج'}
      </button>
    </div>
  );
}

function ProductCard({ product, onChanged }: { product: ProductRow; onChanged: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const isVendorOwned = Boolean(product.supplier_id || product.cafe_id || product.roaster_id);

  const saveField = async (field: 'name' | 'price' | 'description' | 'external_url', value: string) => {
    const payload = field === 'price' ? { price: Number(value) } : { [field]: value.trim() || null };
    await supabase.from('products').update(payload).eq('id', product.id);
  };

  const saveCategory = async (category: ProductCategory) => {
    await supabase.from('products').update({ category }).eq('id', product.id);
    onChanged();
  };

  const toggleActive = async () => {
    await supabase.from('products').update({ is_active: !product.is_active }).eq('id', product.id);
    onChanged();
  };

  const setStatus = async (status: 'approved' | 'rejected') => {
    await supabase.from('products').update({ status }).eq('id', product.id);
    onChanged();
  };

  const changeImage = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    const url = await uploadImage(file);
    setUploading(false);
    if (url) {
      await supabase.from('products').update({ image_url: url }).eq('id', product.id);
      onChanged();
    }
  };

  const remove = async () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    const { error } = await supabase.from('products').delete().eq('id', product.id);
    if (error) {
      alert('فشل الحذف: ' + error.message);
      setConfirmingDelete(false);
      return;
    }
    onChanged();
  };

  return (
    <div className={`rounded-2xl border border-latte bg-white p-4 ${!product.is_active ? 'opacity-50' : ''}`}>
      <div className="mb-2 flex items-center justify-between">
        <span className={`rounded-full px-2 py-0.5 text-[10px] ${isVendorOwned ? 'bg-sand text-coffee' : 'bg-gold/20 text-gold'}`}>
          {ownerLabel(product)}
        </span>
        <span className="text-[10px] text-stone">{STATUS_LABEL[product.status]}</span>
      </div>

      <div className="mb-3 flex items-start gap-3">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-sand">
          {product.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.image_url} alt="" className="h-full w-full object-cover" />
          )}
        </div>
        <div className="flex-1">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={(e) => changeImage(e.target.files?.[0])}
            className="w-full text-[10px] file:mr-1 file:rounded-md file:border-0 file:bg-sand file:px-1.5 file:py-0.5 file:text-[10px]"
          />
          {uploading && <p className="text-[10px] text-mocha">جاري الرفع...</p>}
        </div>
      </div>

      <input
        defaultValue={product.name}
        onBlur={(e) => saveField('name', e.target.value)}
        className="mb-2 w-full rounded-lg border border-latte bg-paper px-2 py-1.5 text-sm font-medium text-ink outline-none focus:border-gold"
      />

      <div className="mb-2 grid grid-cols-2 gap-2">
        {isVendorOwned ? (
          <div />
        ) : (
          <select
            defaultValue={product.category ?? 'cups'}
            onChange={(e) => saveCategory(e.target.value as ProductCategory)}
            className="rounded-lg border border-latte bg-paper px-2 py-1.5 text-xs outline-none focus:border-gold"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        )}
        <input
          defaultValue={product.price}
          onBlur={(e) => saveField('price', e.target.value)}
          type="number"
          step="0.01"
          dir="ltr"
          className="rounded-lg border border-latte bg-paper px-2 py-1.5 text-xs outline-none focus:border-gold"
        />
      </div>

      {isVendorOwned && (
        <input
          defaultValue={product.external_url ?? ''}
          onBlur={(e) => saveField('external_url', e.target.value)}
          placeholder="رابط المنتج (يودّي مباشرة له عند التاجر)"
          dir="ltr"
          className="mb-2 w-full rounded-lg border border-latte bg-paper px-2 py-1.5 text-xs text-gold outline-none focus:border-gold"
        />
      )}

      <textarea
        defaultValue={product.description ?? ''}
        onBlur={(e) => saveField('description', e.target.value)}
        placeholder="الوصف..."
        rows={2}
        className="mb-3 w-full rounded-lg border border-latte bg-paper px-2 py-1.5 text-xs outline-none focus:border-gold"
      />

      {isVendorOwned && product.status === 'pending' && (
        <div className="mb-3 flex gap-2">
          <button
            onClick={() => setStatus('approved')}
            className="flex-1 rounded-full bg-gold px-3 py-1.5 text-xs font-bold text-white"
          >
            قبول
          </button>
          <button
            onClick={() => setStatus('rejected')}
            className="flex-1 rounded-full border border-latte px-3 py-1.5 text-xs text-coffee"
          >
            رفض
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-xs text-mocha">
          <input type="checkbox" checked={product.is_active} onChange={toggleActive} />
          مفعّل
        </label>
        <div className="flex items-center gap-2">
          {confirmingDelete && (
            <button
              onClick={() => setConfirmingDelete(false)}
              className="text-xs text-mocha underline"
            >
              تراجع
            </button>
          )}
          <button
            onClick={remove}
            className={`text-xs underline ${confirmingDelete ? 'font-bold text-red-700' : 'text-red-600'}`}
          >
            {confirmingDelete ? 'تأكيد الحذف؟' : 'حذف'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ProductsTab() {
  const [products, setProducts] = useState<ProductRow[] | null>(null);
  const [ownerFilter, setOwnerFilter] = useState<'all' | 'platform' | 'vendor'>('all');

  const load = async () => {
    const { data } = await supabase
      .from('products')
      .select(
        'id, name, category, price, description, image_url, external_url, is_active, status, supplier_id, cafe_id, roaster_id, supplier:supplier_id ( name ), cafe:cafe_id ( name ), roaster:roaster_id ( name )'
      )
      .order('created_at', { ascending: false })
      .returns<ProductRow[]>();
    setProducts(data ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = (products ?? []).filter((p) => {
    const isVendor = Boolean(p.supplier_id || p.cafe_id || p.roaster_id);
    if (ownerFilter === 'platform') return !isVendor;
    if (ownerFilter === 'vendor') return isVendor;
    return true;
  });

  const pendingCount = (products ?? []).filter((p) => p.status === 'pending').length;

  return (
    <div className="space-y-6">
      <NewProductForm onCreated={load} />

      <div className="flex items-center gap-2">
        {(
          [
            ['all', 'الكل'],
            ['platform', 'باريستا دروب'],
            ['vendor', 'الشركاء (موردين/محامص/كوفي)'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setOwnerFilter(value)}
            className={`rounded-full border px-3 py-1.5 text-xs ${
              ownerFilter === value ? 'border-gold bg-gold text-white' : 'border-latte text-coffee'
            }`}
          >
            {label}
          </button>
        ))}
        {pendingCount > 0 && (
          <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700">
            {pendingCount} بانتظار المراجعة
          </span>
        )}
      </div>

      {!products ? (
        <p className="text-mocha">تحميل...</p>
      ) : filtered.length === 0 ? (
        <p className="text-mocha">ما فيه منتجات هنا.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <ProductCard key={p.id} product={p} onChanged={load} />
          ))}
        </div>
      )}
    </div>
  );
}
