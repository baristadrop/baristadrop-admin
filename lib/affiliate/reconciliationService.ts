import type { SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import type { ProviderConversionRecord, ReconciliationStatus } from './types';

const AMOUNT_EPSILON = 0.01; // فرق أقل من فلس واحد يُعتبر نفس القيمة (تقريب عشري)

type InternalConversion = {
  id: string;
  provider_conversion_id: string;
  sale_amount: number;
  conversion_status: string;
};

type ReconciliationSummary = {
  runId: string;
  totalInternal: number;
  totalProvider: number;
  matched: number;
  amountMismatch: number;
  statusMismatch: number;
  missingFromProvider: number;
  missingFromInternal: number;
  duplicates: number;
};

// خوارزمية المطابقة (5.2 بالخطة):
// 1. يجيب التحويلات الداخلية للفترة
// 2. يستقبل سجلات المزوّد للفترة (مُمرَّرة من المستدعي -- إما محول Phase 6
//    عبر adapter.fetchConversions() أو استيراد CSV؛ هذي الدالة ما تجيب
//    البيانات بنفسها عشان ما تعتمد على محول مزوّد لسه مو مبني)
// 3-5. يبني خرائط بحث بـ provider_conversion_id ويقارن المبلغ/الحالة
// 6-7. يكتب affiliate_reconciliation_items ويحدّث ملخص التشغيلة
export async function runReconciliation(
  supabase: SupabaseClient,
  params: {
    affiliateProgramId: string;
    providerCode: string;
    periodStart: Date;
    periodEnd: Date;
    providerRecords: ProviderConversionRecord[];
  }
): Promise<ReconciliationSummary> {
  const { data: run, error: runError } = await supabase
    .from('affiliate_reconciliation_runs')
    .insert({
      affiliate_program_id: params.affiliateProgramId,
      provider_code: params.providerCode,
      period_start: params.periodStart.toISOString(),
      period_end: params.periodEnd.toISOString(),
      status: 'running',
    })
    .select('id')
    .single();

  if (runError || !run) throw new Error(`failed to start reconciliation run: ${runError?.message}`);
  const runId = run.id as string;

  try {
    const { data: internalRows, error: internalError } = await supabase
      .from('affiliate_conversions')
      .select('id, provider_conversion_id, sale_amount, conversion_status')
      .eq('affiliate_program_id', params.affiliateProgramId)
      .gte('conversion_time', params.periodStart.toISOString())
      .lte('conversion_time', params.periodEnd.toISOString());

    if (internalError) throw new Error(`failed to fetch internal conversions: ${internalError.message}`);
    const internal = (internalRows ?? []) as InternalConversion[];

    // خرائط بحث + كشف تكرار (أكثر من سجل مزوّد بنفس provider_conversion_id)
    const providerByKey = new Map<string, ProviderConversionRecord>();
    const duplicateKeys = new Set<string>();
    for (const record of params.providerRecords) {
      if (providerByKey.has(record.providerConversionId)) {
        duplicateKeys.add(record.providerConversionId);
      } else {
        providerByKey.set(record.providerConversionId, record);
      }
    }

    const items: Array<Record<string, unknown>> = [];
    const matchedProviderKeys = new Set<string>();
    const counts = {
      matched: 0,
      amountMismatch: 0,
      statusMismatch: 0,
      missingFromProvider: 0,
      missingFromInternal: 0,
      duplicates: duplicateKeys.size,
    };

    for (const conversion of internal) {
      const provider = providerByKey.get(conversion.provider_conversion_id);

      if (!provider) {
        counts.missingFromProvider += 1;
        items.push(
          reconciliationItem(runId, params.affiliateProgramId, 'MISSING_FROM_PROVIDER', {
            internalConversionId: conversion.id,
            internalAmount: conversion.sale_amount,
            internalStatus: conversion.conversion_status,
          })
        );
        continue;
      }

      matchedProviderKeys.add(conversion.provider_conversion_id);

      const amountMatches = Math.abs(Number(conversion.sale_amount) - Number(provider.amount)) < AMOUNT_EPSILON;
      const statusMatches = conversion.conversion_status.toUpperCase() === provider.status.toUpperCase();

      let status: ReconciliationStatus;
      if (!amountMatches) {
        status = 'AMOUNT_MISMATCH';
        counts.amountMismatch += 1;
      } else if (!statusMatches) {
        status = 'STATUS_MISMATCH';
        counts.statusMismatch += 1;
      } else {
        status = 'MATCHED';
        counts.matched += 1;
      }

      items.push(
        reconciliationItem(runId, params.affiliateProgramId, status, {
          internalConversionId: conversion.id,
          internalAmount: conversion.sale_amount,
          internalStatus: conversion.conversion_status,
          providerAmount: provider.amount,
          providerStatus: provider.status,
          providerRecord: provider.raw ?? null,
        })
      );
    }

    // سجلات عند المزوّد بدون أي تحويلة داخلية مطابقة -- ناقصة من نظامنا
    for (const [key, provider] of providerByKey) {
      if (matchedProviderKeys.has(key) || duplicateKeys.has(key)) continue;
      counts.missingFromInternal += 1;
      items.push(
        reconciliationItem(runId, params.affiliateProgramId, 'MISSING_FROM_INTERNAL', {
          providerAmount: provider.amount,
          providerStatus: provider.status,
          providerRecord: provider.raw ?? null,
        })
      );
    }

    for (const key of duplicateKeys) {
      const provider = providerByKey.get(key);
      items.push(
        reconciliationItem(runId, params.affiliateProgramId, 'DUPLICATE', {
          providerAmount: provider?.amount,
          providerStatus: provider?.status,
          providerRecord: provider?.raw ?? null,
          notes: `duplicate provider_conversion_id: ${key}`,
        })
      );
    }

    if (items.length > 0) {
      const { error: itemsError } = await supabase.from('affiliate_reconciliation_items').insert(items);
      if (itemsError) throw new Error(`failed to write reconciliation items: ${itemsError.message}`);
    }

    await supabase
      .from('affiliate_reconciliation_runs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        total_internal: internal.length,
        total_provider: params.providerRecords.length,
        matched: counts.matched,
        amount_mismatch: counts.amountMismatch,
        status_mismatch: counts.statusMismatch,
        missing_from_provider: counts.missingFromProvider,
        missing_from_internal: counts.missingFromInternal,
        duplicates: counts.duplicates,
      })
      .eq('id', runId);

    return { runId, totalInternal: internal.length, totalProvider: params.providerRecords.length, ...counts };
  } catch (err) {
    await supabase.from('affiliate_reconciliation_runs').update({ status: 'failed', completed_at: new Date().toISOString() }).eq('id', runId);
    throw err;
  }
}

function reconciliationItem(
  runId: string,
  affiliateProgramId: string,
  status: ReconciliationStatus,
  fields: {
    internalConversionId?: string;
    internalAmount?: number;
    internalStatus?: string;
    providerAmount?: number;
    providerStatus?: string;
    providerRecord?: unknown;
    notes?: string;
  }
): Record<string, unknown> {
  return {
    run_id: runId,
    affiliate_program_id: affiliateProgramId,
    recon_status: status,
    internal_conversion_id: fields.internalConversionId ?? null,
    internal_amount: fields.internalAmount ?? null,
    internal_status: fields.internalStatus ?? null,
    provider_amount: fields.providerAmount ?? null,
    provider_status: fields.providerStatus ?? null,
    provider_record: fields.providerRecord ?? null,
    discrepancy_notes: fields.notes ?? null,
  };
}

export function hashReportFile(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

// يمنع استيراد نفس الملف مرتين (بصمة SHA-256) -- يرجع الاستيراد الموجود لو
// اتكرر بدل ما ينشئ صف جديد أو يرمي خطأ فريد غامض.
export async function startReportImport(
  supabase: SupabaseClient,
  params: { affiliateProgramId: string; fileName: string; fileBuffer: Buffer; periodStart?: string; periodEnd?: string }
): Promise<{ outcome: 'started' | 'already_imported'; importId: string }> {
  const fileHash = hashReportFile(params.fileBuffer);

  const { data: existing } = await supabase.from('affiliate_report_imports').select('id, status').eq('file_hash', fileHash).maybeSingle();
  if (existing) return { outcome: 'already_imported', importId: existing.id as string };

  const { data: inserted, error } = await supabase
    .from('affiliate_report_imports')
    .insert({
      affiliate_program_id: params.affiliateProgramId,
      file_name: params.fileName,
      file_hash: fileHash,
      period_start: params.periodStart ?? null,
      period_end: params.periodEnd ?? null,
      status: 'pending',
    })
    .select('id')
    .single();

  if (error || !inserted) throw new Error(`failed to start report import: ${error?.message}`);
  return { outcome: 'started', importId: inserted.id as string };
}
