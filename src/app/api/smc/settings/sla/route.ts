import { NextRequest, NextResponse } from 'next/server';
import { requireRequestIdentity, RequestAuthError } from '@/lib/server-auth';
import { getFirebaseAdmin } from '@/firebase/server';
import { DEFAULT_SLA_CONFIG, type SlaConfig } from '@/lib/sla';
import { SLA_CONFIG_DOC_ID, normalizeSlaConfig } from '@/lib/sla-config-server';
import { validateDepartmentId } from '@/ai/agents/types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/smc/settings/sla
 * View SLA configuration. Allowed for department_head, official, and admin.
 */
export async function GET(request: NextRequest) {
  try {
    const identity = await requireRequestIdentity(request, ['official', 'admin']);
    const { firestore } = await getFirebaseAdmin();

    const docSnap = await firestore.collection('settings').doc(SLA_CONFIG_DOC_ID).get();
    let config: SlaConfig = DEFAULT_SLA_CONFIG;

    if (docSnap.exists) {
      config = normalizeSlaConfig(docSnap.data());
    }

    // If caller is department_head, filter response to global defaults + their specific department overrides
    if (identity.role === 'department_head') {
      const userDeptId = validateDepartmentId(identity.profile.departmentId || identity.profile.department);
      return NextResponse.json({
        success: true,
        role: identity.role,
        departmentId: userDeptId,
        config: {
          global: config.global,
          departmentOverride: config.departmentOverrides?.[userDeptId] || null,
          updatedAt: config.updatedAt,
        },
      });
    }

    return NextResponse.json({
      success: true,
      role: identity.role,
      config,
    });
  } catch (error: any) {
    if (error instanceof RequestAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[GET /api/smc/settings/sla] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch SLA configuration.' }, { status: 500 });
  }
}

/**
 * POST /api/smc/settings/sla
 * Update SLA configuration. Strictly restricted to 'official' or 'admin' users.
 * Department heads receive 403 Forbidden if attempting to mutate global SLA config.
 */
export async function POST(request: NextRequest) {
  try {
    // Strictly restrict mutation to 'official' or 'admin'
    const identity = await requireRequestIdentity(request, ['official', 'admin']);
    const body = await request.json();
    const { global, departmentOverrides } = body;

    if (!global || typeof global !== 'object') {
      return NextResponse.json({ error: 'Invalid SLA configuration payload.' }, { status: 400 });
    }

    const { firestore } = await getFirebaseAdmin();
    const timestampIso = new Date().toISOString();

    const updatedConfig: SlaConfig = {
      global: {
        Critical: {
          priority: 'Critical',
          responseHours: Number(global.Critical?.responseHours || 2),
          resolutionHours: Number(global.Critical?.resolutionHours || 12),
          reminderBeforeBreachHours: Number(global.Critical?.reminderBeforeBreachHours || 2),
        },
        High: {
          priority: 'High',
          responseHours: Number(global.High?.responseHours || 4),
          resolutionHours: Number(global.High?.resolutionHours || 24),
          reminderBeforeBreachHours: Number(global.High?.reminderBeforeBreachHours || 4),
        },
        Medium: {
          priority: 'Medium',
          responseHours: Number(global.Medium?.responseHours || 8),
          resolutionHours: Number(global.Medium?.resolutionHours || 48),
          reminderBeforeBreachHours: Number(global.Medium?.reminderBeforeBreachHours || 8),
        },
        Low: {
          priority: 'Low',
          responseHours: Number(global.Low?.responseHours || 12),
          resolutionHours: Number(global.Low?.resolutionHours || 72),
          reminderBeforeBreachHours: Number(global.Low?.reminderBeforeBreachHours || 12),
        },
      },
      departmentOverrides: departmentOverrides || {},
      updatedAt: timestampIso,
      updatedBy: identity.uid,
    };

    await firestore.collection('settings').doc(SLA_CONFIG_DOC_ID).set(normalizeSlaConfig(updatedConfig));

    return NextResponse.json({
      success: true,
      message: 'SLA configuration updated successfully.',
      config: updatedConfig,
    });
  } catch (error: any) {
    if (error instanceof RequestAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[POST /api/smc/settings/sla] Error:', error);
    return NextResponse.json({ error: 'Failed to update SLA configuration.' }, { status: 500 });
  }
}
