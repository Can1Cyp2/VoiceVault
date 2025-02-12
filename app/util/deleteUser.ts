/* 

delete from auth.users
where id in (
   select id from auth.users where raw_user_meta_data->>'deleted' = 'true'
);

*/
