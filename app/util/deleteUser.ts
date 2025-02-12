/* -- Find all deleted users (manual cleanup)
SELECT * FROM auth.users WHERE raw_user_meta_data->>'deleted' = 'true';
*/
