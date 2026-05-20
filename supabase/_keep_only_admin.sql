-- Remove every demo profile except admin. Unlink cards first so FK is happy.
update public.corporate_cards
   set holder_user_id = null
 where holder_user_id in (select id from public.users where email <> 'admin@demo.io');

delete from public.users where email <> 'admin@demo.io';
