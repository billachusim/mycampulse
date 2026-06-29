
REVOKE EXECUTE ON FUNCTION public.award_campoints(uuid,public.campoint_reason,integer,text,uuid,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.award_for_post() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.award_for_comment() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.award_for_like() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_ledger_to_balance() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_referral_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_redemption() FROM PUBLIC, anon, authenticated;
