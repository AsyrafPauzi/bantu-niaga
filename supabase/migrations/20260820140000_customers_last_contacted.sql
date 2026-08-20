-- Marketing Strong: contact stamps for follow-up desk / segments
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS last_contacted_at timestamptz;

COMMENT ON COLUMN public.customers.last_contacted_at IS
  'Last WhatsApp CTC / Mark-sent contact stamp for follow-up segments.';

CREATE INDEX IF NOT EXISTS customers_business_last_contacted_idx
  ON public.customers (business_id, last_contacted_at)
  WHERE deleted_at IS NULL AND merged_into_id IS NULL;
