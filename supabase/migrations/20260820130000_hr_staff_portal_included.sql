-- Staff self-service portal is included on Solo+ (HR pillar).
-- Runtime also grants via hasStaffPortalAddon when hasPillar(tier, 'hr').
UPDATE public.marketplace_addons
SET included_in_tier = ARRAY['micro', 'sme', 'enterprise']::text[]
WHERE slug = 'hr-staff-portal';
