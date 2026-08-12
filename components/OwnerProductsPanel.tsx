'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { uploadOwnerProductImage } from '@/lib/productUpload';
import { DirhamIcon } from '@/components/icons/DirhamIcon';
import { iconGlyph } from '@/lib/categoryIcons';

type OwnerType = 'supplier' | 'roaster';

type ProductCategoryRow = {
  key: string;
  name_ar: string;
  name_en: string;
  icon: string;
  sort_order: number;
};

type ProductRow = {
  id: string;
  name: string;
  price: number;
  category: string | null;
  description: string | null;
  image_url: string | null;
  external_url: string | null;
  is_active: boolean;
  status: 'pending' | 'approved' | 'rejected';
};

const STATUS_LABEL: Record<ProductRow['status'], string> = {
  pending: 'بانتظار المراجعة',
  approved: 'مقبول ✓',
  rejected: 'مرفوض',
};

/** كتالوج منتجات ذاتي الخدمة — يُستخدم داخل بوابة المورّد/الكوفي شوب. كل منتج
 * جديد يبدأ pending إجبارياً (يفرضه trigger بقاعدة البيانات نفسها، مو الواجهة)
 * ويحتاج موافقة الأدمن قبل ما يظهر عام. راجع migration 0036. */
const OWNER_COLUMN: Record<OwnerType, 'supplier_id' | 'roaster_id'> = {
  supplier: 'supplier_id',
  roaster: 'roaster_id',
};

const OWNER_TABLE: Record<OwnerType, 'suppliers' | 'roasters'> = {
  supplier: 'suppliers',
  roaster: 'roasters',
};

export function OwnerProductsPanel({ ownerType, ownerId }: { ownerType: OwnerType; ownerId: string }) {
  const ownerColumn = OWNER_COLUMN[ownerType];
  const ownerTable = OWNER_TABLE[ownerType];
  const [products, setProducts] = useState<ProductRow[] | null>(null);
  const [categories, setCategories] = useState<ProductCategoryRow[]>([]);
  const [productLimit, setProductLimit] = useState(5);

  const load = async () => {
    const { data } = await supabase
      .from('products')
      .select('id, name, price, category, description, image_url, external_url, is_active, status')
      .eq(ownerColumn, ownerId)
      .order('created_at', { ascending: false })
      .returns<ProductRow[]>();
    setProducts(data ?? []);
  };

  const loadCategories = async () => {
    const { data } = await supabase
      .from('product_categories')
      .select('key, name_ar, name_en, icon, sort_order')
      .order('sort_order')
      .returns<ProductCategoryRow[]>();
    setCategories(data ?? []);
  };

  const loadLimit = async () => {
    const { data } = await supabase.from(ownerTable).select('product_limit').eq('id', ownerId).maybeSingle();
    if (data) setProductLimit((data as { product_limit: number }).product_limit);
  };

  useEffect(() => {
    load();
    loadCategories();
    loadLimit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId]);

  const atLimit = products != null && products.length >= productLimit;

  return (
    <div className="mt-6 rounded-2xl border border-latte bg-white p-5 shadow-sm">
      <div className="mb-1 flex items-center justify-between">
        <p className="font-[var(--font-el-messiri)] text-base text-ink">منتجاتنا</p>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${atLimit ? 'bg-red-100 text-red-700' : 'bg-sand text-mocha'}`}>
          {products?.length ?? 0} / {productLimit}
        </span>
      </div>
      <p className="mb-3 text-xs text-mocha">
        تظهر بصفحتك وبقسم المتجر العام بالتطبيق بعد موافقة الأدمن. رابط المنتج لازم يودّي
        العميل مباشرة لنفس المنتج بموقعك أو صفحتك — مو رابط الموقع العام.
      </p>
      {atLimit && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          وصلت للحد المسموح بحسابك الحالي. تواصل مع فريق باريستا دروب لزيادة الحد.
        </p>
      )}
      <NewProductForm ownerColumn={ownerColumn} ownerId={ownerId} categories={categories} atLimit={atLimit} onCreated={load} />
      <div className="mt-4 space-y-3">
        {!products ? (
          <p className="text-sm text-mocha">تحميل...</p>
        ) : products.length === 0 ? (
          <p className="text-sm text-mocha">ما أضفت أي منتج بعد.</p>
        ) : (
          products.map((p) => (
            <ProductRowItem key={p.id} product={p} ownerId={ownerId} categories={categories} onChanged={load} />
          ))
        )}
      </div>
    </div>
  );
}

function NewProductForm({
  ownerColumn,
  ownerId,
  categories,
  atLimit,
  onCreated,
}: {
  ownerColumn: 'supplier_id' | 'roaster_id';
  ownerId: string;
  categories: ProductCategoryRow[];
  atLimit: boolean;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!category && categories[0]) setCategory(categories[0].key);
  }, [categories, category]);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    const url = await uploadOwnerProductImage(ownerId, file);
    if (url) setImageUrl(url);
    setUploading(false);
  };

  const canSubmit =
    name.trim().length > 0 && price.trim().length > 0 && externalUrl.trim().length > 0 && !uploading && !atLimit;

  const submit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setMessage(null);
    const { error } = await supabase.from('products').insert({
      [ownerColumn]: ownerId,
      name: name.trim(),
      category: category || null,
      price: Number(price),
      description: description.trim() || null,
      external_url: externalUrl.trim(),
      image_url: imageUrl,
      is_active: true,
    });
    setSubmitting(false);
    if (error) {
      setMessage(
        error.message.includes('PRODUCT_LIMIT_REACHED')
          ? 'وصلت للحد المسموح من المنتجات بحسابك الحالي.'
          : 'صار خطأ، جرّب مرة ثانية'
      );
      return;
    }
    setName('');
    setCategory(categories[0]?.key ?? '');
    setPrice('');
    setDescription('');
    setExternalUrl('');
    setImageUrl(null);
    if (fileRef.current) fileRef.current.value = '';
    setMessage('تم إرسال المنتج للمراجعة ✓');
    onCreated();
  };

  return (
    <div className="rounded-xl border border-dashed border-stone bg-paper/60 p-4">
      {message && <p className="mb-3 rounded-lg bg-sand px-3 py-2 text-sm text-coffee">{message}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="اسم المنتج"
          className="rounded-lg border border-latte bg-white px-3 py-2 text-sm outline-none focus:border-gold"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border border-latte bg-white px-3 py-2 text-sm outline-none focus:border-gold"
        >
          {categories.map((c) => (
            <option key={c.key} value={c.key}>
              {iconGlyph(c.icon)} {c.name_ar}
            </option>
          ))}
        </select>
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          type="number"
          step="0.01"
          dir="ltr"
          placeholder="السعر (د.إ)"
          className="rounded-lg border border-latte bg-white px-3 py-2 text-sm outline-none focus:border-gold"
        />
        <input
          value={externalUrl}
          onChange={(e) => setExternalUrl(e.target.value)}
          placeholder="رابط المنتج (يودّي مباشرة لنفس المنتج بموقعك)"
          dir="ltr"
          className="rounded-lg border border-latte bg-white px-3 py-2 text-sm outline-none focus:border-gold sm:col-span-2"
        />
        <div className="sm:col-span-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={(e) => handleFile(e.target.files?.[0])}
            className="w-full rounded-lg border border-latte bg-white px-3 py-1.5 text-xs outline-none file:mr-2 file:rounded-md file:border-0 file:bg-sand file:px-2 file:py-1 file:text-xs"
          />
          {uploading && <p className="mt-1 text-xs text-mocha">جاري الرفع...</p>}
          {imageUrl && !uploading && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="mt-2 h-14 w-14 rounded-lg object-cover" />
          )}
        </div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="الوصف (اختياري)"
          rows={2}
          className="rounded-lg border border-latte bg-white px-3 py-2 text-sm outline-none focus:border-gold sm:col-span-2"
        />
      </div>
      <button
        onClick={submit}
        disabled={!canSubmit || submitting}
        className="mt-3 rounded-full bg-ink px-5 py-2 text-sm font-medium text-cream disabled:opacity-40"
      >
        {submitting ? 'جاري الإرسال...' : 'إضافة منتج'}
      </button>
    </div>
  );
}

function ProductRowItem({
  product,
  ownerId,
  categories,
  onChanged,
}: {
  product: ProductRow;
  ownerId: string;
  categories: ProductCategoryRow[];
  onChanged: () => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [uploading, setUploading] = useState(false);

  const toggleActive = async () => {
    await supabase.from('products').update({ is_active: !product.is_active }).eq('id', product.id);
    onChanged();
  };

  const saveField = async (field: 'name' | 'price' | 'description' | 'external_url', value: string) => {
    const payload = field === 'price' ? { price: Number(value) } : { [field]: value.trim() || null };
    await supabase.from('products').update(payload).eq('id', product.id);
  };

  const saveCategory = async (category: string) => {
    await supabase.from('products').update({ category }).eq('id', product.id);
    onChanged();
  };

  const changeImage = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    const url = await uploadOwnerProductImage(ownerId, file);
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
    await supabase.from('products').delete().eq('id', product.id);
    onChanged();
  };

  return (
    <div className="flex items-center gap-3 rounded-xl border border-latte p-3">
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-sand">
        {product.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.image_url} alt="" className="h-full w-full object-cover" />
        )}
      </div>
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <input
            defaultValue={product.name}
            onBlur={(e) => saveField('name', e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-latte bg-paper px-2 py-1 text-sm font-medium text-ink outline-none focus:border-gold"
          />
          <div className="flex shrink-0 items-center gap-1 text-xs text-mocha">
            <input
              defaultValue={product.price}
              onBlur={(e) => saveField('price', e.target.value)}
              type="number"
              step="0.01"
              dir="ltr"
              className="w-16 rounded-lg border border-latte bg-paper px-1.5 py-1 text-xs outline-none focus:border-gold"
            />
            <DirhamIcon />
          </div>
        </div>
        <select
          value={product.category ?? categories[0]?.key ?? ''}
          onChange={(e) => saveCategory(e.target.value)}
          className="w-full rounded-lg border border-latte bg-paper px-2 py-1 text-xs outline-none focus:border-gold"
        >
          {categories.map((c) => (
            <option key={c.key} value={c.key}>
              {iconGlyph(c.icon)} {c.name_ar}
            </option>
          ))}
        </select>
        <input
          defaultValue={product.external_url ?? ''}
          onBlur={(e) => saveField('external_url', e.target.value)}
          placeholder="رابط المنتج"
          dir="ltr"
          className="w-full rounded-lg border border-latte bg-paper px-2 py-1 text-xs text-gold outline-none focus:border-gold"
        />
        <textarea
          defaultValue={product.description ?? ''}
          onBlur={(e) => saveField('description', e.target.value)}
          placeholder="الوصف..."
          rows={1}
          className="w-full rounded-lg border border-latte bg-paper px-2 py-1 text-xs outline-none focus:border-gold"
        />
        <p className="text-xs text-stone">{STATUS_LABEL[product.status]}</p>
        <label className="inline-block cursor-pointer text-xs text-gold underline">
          {uploading ? 'جاري الرفع...' : 'تغيير الصورة'}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => changeImage(e.target.files?.[0])} disabled={uploading} />
        </label>
      </div>
      <div className="flex flex-col items-end gap-2">
        <label className="flex items-center gap-1.5 text-xs text-mocha">
          <input type="checkbox" checked={product.is_active} onChange={toggleActive} />
          مفعّل
        </label>
        <div className="flex items-center gap-2">
          {confirmingDelete && (
            <button onClick={() => setConfirmingDelete(false)} className="text-xs text-mocha underline">
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
