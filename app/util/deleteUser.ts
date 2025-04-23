/* 

// This is a script to delete users from the database who have been marked as deleted in the raw_user_meta_data field. Currently we are using a boolean field called 'deleted' to mark users for deletion.
delete from auth.users
where id in (
   select id from auth.users where raw_user_meta_data->>'deleted' = 'true'
);

*/
