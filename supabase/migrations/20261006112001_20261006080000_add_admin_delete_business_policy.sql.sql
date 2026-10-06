/*
# Add admin DELETE policy on businesses table

## What this does
The admin panel needs to delete demo businesses. The existing schema has
admin SELECT and UPDATE policies on businesses, but no admin DELETE policy.
This adds one so super_admin users can remove any business (and its listings
via CASCADE).

## Security
- DELETE policy scoped to super_admin role only via is_super_admin() check
- No changes to existing owner-scoped policies
*/

DROP POLICY IF EXISTS "admin_businesses_delete" ON businesses;
CREATE POLICY "admin_businesses_delete"
ON businesses FOR DELETE TO authenticated
USING (is_super_admin(auth.uid()));
