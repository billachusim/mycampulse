
-- =========================================================================
-- CAMPULSE DEMO SEED
-- All dummy users use @campulse.test emails so they can be wiped with:
--   DELETE FROM auth.users WHERE email LIKE '%@campulse.test';
-- =========================================================================

-- ---------- 1. Dummy auth users ----------
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token, email_change, email_change_token_new, recovery_token
)
SELECT
  '00000000-0000-0000-0000-000000000000'::uuid,
  d.id::uuid, 'authenticated', 'authenticated', d.email,
  '$2a$10$DEMOSEEDDEMOSEEDDEMOSEEDDEMOSEEDDEMOSEEDDEMOSEEDDIS',
  now() - (interval '30 days'), now() - (interval '30 days'), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('display_name', d.display_name),
  false, '', '', '', ''
FROM (VALUES
  ('11111111-0000-0000-0000-000000000001','ada@campulse.test','Ada Nwosu'),
  ('11111111-0000-0000-0000-000000000002','tunde@campulse.test','Tunde Bakare'),
  ('11111111-0000-0000-0000-000000000003','zainab@campulse.test','Zainab Aliyu'),
  ('11111111-0000-0000-0000-000000000004','chuka@campulse.test','Chuka Okafor'),
  ('11111111-0000-0000-0000-000000000005','bisi@campulse.test','Bisi Adewale'),
  ('11111111-0000-0000-0000-000000000006','kemi@campulse.test','Kemi Olatunji'),
  ('11111111-0000-0000-0000-000000000007','ifeoma@campulse.test','Ifeoma Eze'),
  ('11111111-0000-0000-0000-000000000008','femi@campulse.test','Femi Adeyemi'),
  ('11111111-0000-0000-0000-000000000009','david@campulse.test','David Obi'),
  ('11111111-0000-0000-0000-000000000010','sarah@campulse.test','Sarah Johnson'),
  ('11111111-0000-0000-0000-000000000011','musa@campulse.test','Musa Ibrahim'),
  ('11111111-0000-0000-0000-000000000012','grace@campulse.test','Grace Okon'),
  ('11111111-0000-0000-0000-000000000013','peter@campulse.test','Peter Adesina'),
  ('11111111-0000-0000-0000-000000000014','mary@campulse.test','Mary Uzo'),
  ('11111111-0000-0000-0000-000000000015','samuel@campulse.test','Samuel Yusuf'),
  ('11111111-0000-0000-0000-000000000016','funke@campulse.test','Funke Bello')
) AS d(id, email, display_name)
ON CONFLICT (id) DO NOTHING;

-- ---------- 2. Dummy profiles ----------
INSERT INTO public.profiles (id, handle, display_name, avatar_url, bio, primary_school_id, faculty_id, department_id, level, hostel, verified, onboarded)
VALUES
  ('11111111-0000-0000-0000-000000000001','ada','Ada Nwosu','https://api.dicebear.com/7.x/avataaars/svg?seed=ada','CS @ UNILAG · loves Next.js & jollof debates 🌶️','ab18bb80-a9ff-4479-9d81-20aeceb7bc2e','8d0f1c9d-a02e-4b3d-be62-d1950ac5067d','74a89069-217a-4991-911d-0be9184f7387','300L','Mariere',true,true),
  ('11111111-0000-0000-0000-000000000002','tunde','Tunde Bakare','https://api.dicebear.com/7.x/avataaars/svg?seed=tunde','Mech Eng · UNILAG · cars, code, coffee','ab18bb80-a9ff-4479-9d81-20aeceb7bc2e','8d0f1c9d-a02e-4b3d-be62-d1950ac5067d','ebbedbba-aaef-4b9e-8d99-4c7c7452379d','200L','Jaja',true,true),
  ('11111111-0000-0000-0000-000000000003','zainab','Zainab Aliyu','https://api.dicebear.com/7.x/avataaars/svg?seed=zainab','Law @ ABU · debate club VP · ☕','711e0c45-2580-4411-af1f-a0fb313f40f4',NULL,NULL,'400L','Suleiman',true,true),
  ('11111111-0000-0000-0000-000000000004','chuka','Chuka Okafor','https://api.dicebear.com/7.x/avataaars/svg?seed=chuka','Medicine @ UNN · trying to survive 100L','cfb24057-4407-42b3-bc4e-ab3d83134505',NULL,NULL,'100L','Eyo Ita',true,true),
  ('11111111-0000-0000-0000-000000000005','bisi','Bisi Adewale','https://api.dicebear.com/7.x/avataaars/svg?seed=bisi','SUG VP @ OAU · making the campus louder','b218dbdd-083d-4cf2-a82d-6c08a811d4ef',NULL,NULL,'400L','Mozambique',true,true),
  ('11111111-0000-0000-0000-000000000006','kemi','Kemi Olatunji','https://api.dicebear.com/7.x/avataaars/svg?seed=kemi','Theatre Arts @ UI · stage > stress','a7db759d-c3b4-40d8-845f-fcac90d31cab',NULL,NULL,'300L','Queens',true,true),
  ('11111111-0000-0000-0000-000000000007','ifeoma','Ifeoma Eze','https://api.dicebear.com/7.x/avataaars/svg?seed=ifeoma','Pharmacy @ UNIBEN · pills & playlists','9bdd74d4-b8c7-4b4b-9857-da2412c62f7b',NULL,NULL,'500L','Hall 1',true,true),
  ('11111111-0000-0000-0000-000000000008','femi','Femi Adeyemi','https://api.dicebear.com/7.x/avataaars/svg?seed=femi','Architecture @ FUTA · sketches & site visits','51089f2c-bd99-4edd-ac47-4e7e01e6b678',NULL,NULL,'400L','Off-campus',true,true),
  ('11111111-0000-0000-0000-000000000009','david','David Obi','https://api.dicebear.com/7.x/avataaars/svg?seed=david','ICT @ Covenant · founder of CU Hackers','33271a5d-7991-41e5-bdf4-65d3c206a4b2',NULL,NULL,'300L','Daniel',true,true),
  ('11111111-0000-0000-0000-000000000010','sarahj','Sarah Johnson','https://api.dicebear.com/7.x/avataaars/svg?seed=sarahj','Mass Comm @ UNILAG · campus journalist','ab18bb80-a9ff-4479-9d81-20aeceb7bc2e',NULL,NULL,'300L','Moremi',true,true),
  ('11111111-0000-0000-0000-000000000011','musa','Musa Ibrahim','https://api.dicebear.com/7.x/avataaars/svg?seed=musa','Engineering @ ABU · football is life ⚽','711e0c45-2580-4411-af1f-a0fb313f40f4',NULL,NULL,'200L','Ribadu',false,true),
  ('11111111-0000-0000-0000-000000000012','grace','Grace Okon','https://api.dicebear.com/7.x/avataaars/svg?seed=grace','Biochem @ UNN · researcher in the making','cfb24057-4407-42b3-bc4e-ab3d83134505',NULL,NULL,'400L','Mary Slessor',true,true),
  ('11111111-0000-0000-0000-000000000013','peter','Peter Adesina','https://api.dicebear.com/7.x/avataaars/svg?seed=peter','Econs @ OAU · markets, music, memes','b218dbdd-083d-4cf2-a82d-6c08a811d4ef',NULL,NULL,'200L','Awo',true,true),
  ('11111111-0000-0000-0000-000000000014','mary','Mary Uzo','https://api.dicebear.com/7.x/avataaars/svg?seed=mary','English @ UI · poet & playlist curator','a7db759d-c3b4-40d8-845f-fcac90d31cab',NULL,NULL,'200L','Queen Elizabeth',false,true),
  ('11111111-0000-0000-0000-000000000015','samuel','Samuel Yusuf','https://api.dicebear.com/7.x/avataaars/svg?seed=samuel','Civil Eng @ FUTA · building things ⚒️','51089f2c-bd99-4edd-ac47-4e7e01e6b678',NULL,NULL,'500L','Akure South',true,true),
  ('11111111-0000-0000-0000-000000000016','funke','Funke Bello','https://api.dicebear.com/7.x/avataaars/svg?seed=funke','Business Admin @ Covenant · side-hustle queen','33271a5d-7991-41e5-bdf4-65d3c206a4b2',NULL,NULL,'400L','Lydia',true,true)
ON CONFLICT (id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  handle = EXCLUDED.handle,
  avatar_url = EXCLUDED.avatar_url,
  bio = EXCLUDED.bio,
  primary_school_id = EXCLUDED.primary_school_id,
  level = EXCLUDED.level,
  hostel = EXCLUDED.hostel,
  verified = EXCLUDED.verified,
  onboarded = EXCLUDED.onboarded;

-- ---------- 3. Update admin (you) profile ----------
UPDATE public.profiles SET
  handle = 'sim',
  display_name = 'Sim Nachu',
  avatar_url = 'https://api.dicebear.com/7.x/avataaars/svg?seed=sim',
  bio = 'Building Campulse · Founder · hops between every campus 👀',
  primary_school_id = 'ab18bb80-a9ff-4479-9d81-20aeceb7bc2e',
  faculty_id = '8d0f1c9d-a02e-4b3d-be62-d1950ac5067d',
  department_id = '74a89069-217a-4991-911d-0be9184f7387',
  level = '400L',
  hostel = 'Off-campus',
  verified = true,
  onboarded = true
WHERE id = '69fa0e3c-4826-466c-9e0a-996097ec9fda';

-- ---------- 4. Memberships ----------
INSERT INTO public.memberships (user_id, community_id, role)
SELECT u, c, 'member' FROM (VALUES
  -- admin joins UNILAG core communities
  ('69fa0e3c-4826-466c-9e0a-996097ec9fda'::uuid, '5ee469bc-8e7d-4fe3-a7ed-fd79dd97577a'::uuid),
  ('69fa0e3c-4826-466c-9e0a-996097ec9fda', '351bee99-8a42-4dcb-80e3-ae39baf3e034'),
  ('69fa0e3c-4826-466c-9e0a-996097ec9fda', '19553f32-720b-4e28-80a4-342490826fe7'),
  ('69fa0e3c-4826-466c-9e0a-996097ec9fda', 'd33ffe94-ce07-43f6-9057-85eff66a6108'),
  ('69fa0e3c-4826-466c-9e0a-996097ec9fda', '53738fec-dd7c-451b-b814-2cab56b7cad9'),
  -- Ada (UNILAG)
  ('11111111-0000-0000-0000-000000000001', '51aaee2b-b35f-4592-a7fd-ff0ff506200c'),
  ('11111111-0000-0000-0000-000000000001', '53738fec-dd7c-451b-b814-2cab56b7cad9'),
  ('11111111-0000-0000-0000-000000000001', '5ee469bc-8e7d-4fe3-a7ed-fd79dd97577a'),
  -- Tunde (UNILAG)
  ('11111111-0000-0000-0000-000000000002', '01626f4e-405f-4079-ba6d-452978ad7378'),
  ('11111111-0000-0000-0000-000000000002', '351bee99-8a42-4dcb-80e3-ae39baf3e034'),
  -- Sarah (UNILAG)
  ('11111111-0000-0000-0000-000000000010', '51aaee2b-b35f-4592-a7fd-ff0ff506200c'),
  ('11111111-0000-0000-0000-000000000010', '5ee469bc-8e7d-4fe3-a7ed-fd79dd97577a'),
  -- Zainab + Musa (ABU)
  ('11111111-0000-0000-0000-000000000003', '08500521-ce18-47d4-b0d9-8fe32fa4c27a'),
  ('11111111-0000-0000-0000-000000000003', 'cc35e74c-b070-4361-bbce-127e438bdca0'),
  ('11111111-0000-0000-0000-000000000011', 'e8e87f89-f1da-4e77-9f38-768e87d2d4b5'),
  -- OAU Bisi + Peter
  ('11111111-0000-0000-0000-000000000005', '665199c9-bccf-46ca-bd37-23c27ca52a95'),
  ('11111111-0000-0000-0000-000000000013', '437825e3-856b-4c05-9489-c6df80a66e3a'),
  -- UNN Chuka + Grace
  ('11111111-0000-0000-0000-000000000004', 'fa46f726-2cf5-4a25-88c2-9d81ba73a6bd'),
  ('11111111-0000-0000-0000-000000000012', 'f2c08550-efcb-460d-8224-c439306e5008')
) AS m(u,c)
ON CONFLICT DO NOTHING;

-- ---------- 5. Posts ----------
-- Helper note: like_count/comment_count are stored on the row (kept by triggers normally),
-- but for seed we set them directly to influence Trending ranking.
INSERT INTO public.posts (id, author_id, school_id, community_id, body, like_count, comment_count, created_at)
VALUES
  -- UNILAG school-wide (trending winners)
  (gen_random_uuid(),'11111111-0000-0000-0000-000000000001','ab18bb80-a9ff-4479-9d81-20aeceb7bc2e',NULL,'PSA: the WiFi in the new lab actually works today. Pop in before the rush 🙏 (dummy seed)',182,47, now() - interval '2 hours'),
  (gen_random_uuid(),'11111111-0000-0000-0000-000000000002','ab18bb80-a9ff-4479-9d81-20aeceb7bc2e',NULL,'Strike rumour is FAKE. I just left admin block, lectures continue Monday. Stop spreading panic.',164,89, now() - interval '5 hours'),
  (gen_random_uuid(),'11111111-0000-0000-0000-000000000010','ab18bb80-a9ff-4479-9d81-20aeceb7bc2e',NULL,'Campus Journal dropping our SUG election coverage tonight 🎙️ stay tuned',97,18, now() - interval '8 hours'),
  (gen_random_uuid(),'11111111-0000-0000-0000-000000000001','ab18bb80-a9ff-4479-9d81-20aeceb7bc2e','d33ffe94-ce07-43f6-9057-85eff66a6108','400L people — DSA test moved to next Wednesday. Past questions in the group chat.',58,22, now() - interval '11 hours'),
  (gen_random_uuid(),'11111111-0000-0000-0000-000000000002','ab18bb80-a9ff-4479-9d81-20aeceb7bc2e','351bee99-8a42-4dcb-80e3-ae39baf3e034','📱 Selling iPhone 12 (clean, no scratch). 380k. DM if interested. #marketplace',41,14, now() - interval '14 hours'),
  (gen_random_uuid(),'11111111-0000-0000-0000-000000000010','ab18bb80-a9ff-4479-9d81-20aeceb7bc2e','19553f32-720b-4e28-80a4-342490826fe7','🎤 Open Mic night this Friday @ MBA Auditorium, 6pm. Free entry, bring a friend.',73,11, now() - interval '17 hours'),
  (gen_random_uuid(),'11111111-0000-0000-0000-000000000001','ab18bb80-a9ff-4479-9d81-20aeceb7bc2e','5ee469bc-8e7d-4fe3-a7ed-fd79dd97577a','Town hall on hostel water supply this Thursday. SUG please show face this time.',55,33, now() - interval '20 hours'),

  -- UNILAG confessions / hostel
  (gen_random_uuid(),'11111111-0000-0000-0000-000000000002','ab18bb80-a9ff-4479-9d81-20aeceb7bc2e','3f7317a7-43f1-4518-bc65-413c9d8c31b5','Confession: I''ve been sleeping in the library because my roommate snores like generator. Help.',122,41, now() - interval '6 hours'),
  (gen_random_uuid(),'11111111-0000-0000-0000-000000000001','ab18bb80-a9ff-4479-9d81-20aeceb7bc2e','6540c0e8-443e-4f80-ad67-fd9a804585d3','Mariere block C — water just came back, fill your buckets NOW.',88,9, now() - interval '3 hours'),

  -- ABU
  (gen_random_uuid(),'11111111-0000-0000-0000-000000000003','711e0c45-2580-4411-af1f-a0fb313f40f4',NULL,'ABU law faculty quiz tomorrow 4pm. Bring your A-game, prize money is real this time.',64,12, now() - interval '4 hours'),
  (gen_random_uuid(),'11111111-0000-0000-0000-000000000011','711e0c45-2580-4411-af1f-a0fb313f40f4',NULL,'ABU vs UNILORIN match this Saturday. Buses leaving 7am sharp from main gate.',91,28, now() - interval '9 hours'),
  (gen_random_uuid(),'11111111-0000-0000-0000-000000000003','711e0c45-2580-4411-af1f-a0fb313f40f4','cc35e74c-b070-4361-bbce-127e438bdca0','SUG meeting on tuition review — Friday 5pm Akenzua. Everyone is welcome.',47,15, now() - interval '13 hours'),

  -- OAU
  (gen_random_uuid(),'11111111-0000-0000-0000-000000000005','b218dbdd-083d-4cf2-a82d-6c08a811d4ef',NULL,'Great Ife! We just got approved budget for hostel renovations. Drop your block name & complaints below 👇',201,76, now() - interval '7 hours'),
  (gen_random_uuid(),'11111111-0000-0000-0000-000000000013','b218dbdd-083d-4cf2-a82d-6c08a811d4ef',NULL,'Econs 201 lecture cancelled today. Use the time wisely (or sleep).',58,7, now() - interval '10 hours'),
  (gen_random_uuid(),'11111111-0000-0000-0000-000000000005','b218dbdd-083d-4cf2-a82d-6c08a811d4ef','665199c9-bccf-46ca-bd37-23c27ca52a95','SUG townhall on the new fee structure. We are pushing back. Show up Monday 4pm.',132,54, now() - interval '15 hours'),

  -- UNN
  (gen_random_uuid(),'11111111-0000-0000-0000-000000000012','cfb24057-4407-42b3-bc4e-ab3d83134505',NULL,'Lions! Biochem past questions for last 5 years compiled — link in comments. Free of charge.',114,31, now() - interval '3 hours'),
  (gen_random_uuid(),'11111111-0000-0000-0000-000000000004','cfb24057-4407-42b3-bc4e-ab3d83134505',NULL,'100L medicine survival kit: coffee, panic, prayers. We move 🙏',77,19, now() - interval '6 hours'),
  (gen_random_uuid(),'11111111-0000-0000-0000-000000000012','cfb24057-4407-42b3-bc4e-ab3d83134505','f2c08550-efcb-460d-8224-c439306e5008','400L research project topics due Friday. Don''t be that person who picks last.',39,11, now() - interval '12 hours'),

  -- UI
  (gen_random_uuid(),'11111111-0000-0000-0000-000000000006','a7db759d-c3b4-40d8-845f-fcac90d31cab',NULL,'UI Theatre Arts presents "Cracks" tomorrow 7pm @ Arts Theatre. Tickets ₦500 at the gate.',86,17, now() - interval '5 hours'),
  (gen_random_uuid(),'11111111-0000-0000-0000-000000000014','a7db759d-c3b4-40d8-845f-fcac90d31cab',NULL,'Queens Hall election season is wild this year 😭 Vote wisely, sis.',52,26, now() - interval '8 hours'),

  -- UNIBEN
  (gen_random_uuid(),'11111111-0000-0000-0000-000000000007','9bdd74d4-b8c7-4b4b-9857-da2412c62f7b',NULL,'500L Pharmacy — clinical posting schedule is finally out. Check the noticeboard.',69,8, now() - interval '4 hours'),
  (gen_random_uuid(),'11111111-0000-0000-0000-000000000007','9bdd74d4-b8c7-4b4b-9857-da2412c62f7b',NULL,'Lost: blue HP backpack near Faculty of Pharmacy this morning. Contains laptop charger + notes. Please DM 🙏',43,21, now() - interval '11 hours'),

  -- FUTA
  (gen_random_uuid(),'11111111-0000-0000-0000-000000000008','51089f2c-bd99-4edd-ac47-4e7e01e6b678',NULL,'Architecture studio crit this Friday — 24h shifts incoming. Pray for us.',95,30, now() - interval '6 hours'),
  (gen_random_uuid(),'11111111-0000-0000-0000-000000000015','51089f2c-bd99-4edd-ac47-4e7e01e6b678',NULL,'Civil Eng dept exam timetable out. Statics is on Monday — God help us all 😭',71,14, now() - interval '9 hours'),

  -- Covenant
  (gen_random_uuid(),'11111111-0000-0000-0000-000000000009','33271a5d-7991-41e5-bdf4-65d3c206a4b2',NULL,'CU Hackers meetup Sunday 4pm @ CST 105. Bring your laptop, we''re shipping a side project.',108,22, now() - interval '4 hours'),
  (gen_random_uuid(),'11111111-0000-0000-0000-000000000016','33271a5d-7991-41e5-bdf4-65d3c206a4b2',NULL,'Selling thrifted hoodies (clean, 7k each). DM me, delivery within campus is free.',62,18, now() - interval '7 hours'),
  (gen_random_uuid(),'11111111-0000-0000-0000-000000000009','33271a5d-7991-41e5-bdf4-65d3c206a4b2',NULL,'Anyone else think the dress code is a bit much this week? Let''s talk in the comments.',144,103, now() - interval '13 hours'),

  -- Cross-school / events / gist
  (gen_random_uuid(),'11111111-0000-0000-0000-000000000005','b218dbdd-083d-4cf2-a82d-6c08a811d4ef','285eca6f-dc8a-4184-b784-ab8444e4c049','Inter-school debate finals: OAU vs UI, this Saturday @ NUC Hall. We''re bringing the trophy home 🏆',117,38, now() - interval '2 hours'),
  (gen_random_uuid(),'11111111-0000-0000-0000-000000000006','a7db759d-c3b4-40d8-845f-fcac90d31cab',NULL,'Anybody else think the cafeteria food levelled up this semester? 😋',49,24, now() - interval '5 hours'),
  (gen_random_uuid(),'11111111-0000-0000-0000-000000000013','b218dbdd-083d-4cf2-a82d-6c08a811d4ef','95c62c19-849d-42e9-81c0-0b6161214501','Confession: I''ve had a crush on someone in my tutorial group for 3 months and still haven''t said hi. Help.',187,92, now() - interval '8 hours'),
  (gen_random_uuid(),'11111111-0000-0000-0000-000000000011','711e0c45-2580-4411-af1f-a0fb313f40f4','f0854a02-13d4-4062-8994-d0efb17248d3','100L group chat is wildddd. Welcome to ABU 😂',38,9, now() - interval '14 hours'),
  (gen_random_uuid(),'11111111-0000-0000-0000-000000000014','a7db759d-c3b4-40d8-845f-fcac90d31cab',NULL,'Found a wallet near Tedder Hall today — brown, has student ID for "K. Adeyinka". DM to claim.',31,6, now() - interval '16 hours'),
  (gen_random_uuid(),'11111111-0000-0000-0000-000000000004','cfb24057-4407-42b3-bc4e-ab3d83134505',NULL,'When MED 101 ends and you remember you have stats tomorrow 💀',102,15, now() - interval '19 hours'),
  (gen_random_uuid(),'11111111-0000-0000-0000-000000000016','33271a5d-7991-41e5-bdf4-65d3c206a4b2',NULL,'Tip for freshers: get a powerbank. Trust me on this one.',58,11, now() - interval '21 hours'),

  -- Admin (you) posts
  (gen_random_uuid(),'69fa0e3c-4826-466c-9e0a-996097ec9fda','ab18bb80-a9ff-4479-9d81-20aeceb7bc2e',NULL,'Welcome to Campulse 👋 We''re building this for you — drop feedback, break things, tag me anytime.',230,68, now() - interval '1 hour'),
  (gen_random_uuid(),'69fa0e3c-4826-466c-9e0a-996097ec9fda','ab18bb80-a9ff-4479-9d81-20aeceb7bc2e','19553f32-720b-4e28-80a4-342490826fe7','First Campulse meetup at UNILAG next Sat — free drinks for the first 30 people 🎉',141,29, now() - interval '4 hours'),

  -- One spammy post to test moderation
  (gen_random_uuid(),'11111111-0000-0000-0000-000000000011','711e0c45-2580-4411-af1f-a0fb313f40f4',NULL,'DM ME FOR EASY MONEY MAKING METHOD!!! LIMITED SLOTS!!! 💰💰💰',4,2, now() - interval '30 minutes');

-- ---------- 6. Connections ----------
-- Helper: requester_id, addressee_id, status. Admin = 69fa..., dummies = 1111...
INSERT INTO public.connections (requester_id, addressee_id, status, created_at, updated_at) VALUES
  -- Accepted (admin has connections)
  ('11111111-0000-0000-0000-000000000001','69fa0e3c-4826-466c-9e0a-996097ec9fda','accepted', now() - interval '14 days', now() - interval '13 days'),
  ('11111111-0000-0000-0000-000000000002','69fa0e3c-4826-466c-9e0a-996097ec9fda','accepted', now() - interval '12 days', now() - interval '11 days'),
  ('69fa0e3c-4826-466c-9e0a-996097ec9fda','11111111-0000-0000-0000-000000000005','accepted', now() - interval '10 days', now() - interval '9 days'),
  ('69fa0e3c-4826-466c-9e0a-996097ec9fda','11111111-0000-0000-0000-000000000009','accepted', now() - interval '8 days', now() - interval '7 days'),
  ('11111111-0000-0000-0000-000000000010','69fa0e3c-4826-466c-9e0a-996097ec9fda','accepted', now() - interval '6 days', now() - interval '5 days'),
  ('11111111-0000-0000-0000-000000000012','69fa0e3c-4826-466c-9e0a-996097ec9fda','accepted', now() - interval '4 days', now() - interval '3 days'),
  -- Pending TO admin (you can accept)
  ('11111111-0000-0000-0000-000000000003','69fa0e3c-4826-466c-9e0a-996097ec9fda','pending', now() - interval '2 days', now() - interval '2 days'),
  ('11111111-0000-0000-0000-000000000007','69fa0e3c-4826-466c-9e0a-996097ec9fda','pending', now() - interval '1 day', now() - interval '1 day'),
  ('11111111-0000-0000-0000-000000000013','69fa0e3c-4826-466c-9e0a-996097ec9fda','pending', now() - interval '3 hours', now() - interval '3 hours'),
  -- Pending FROM admin (sent)
  ('69fa0e3c-4826-466c-9e0a-996097ec9fda','11111111-0000-0000-0000-000000000006','pending', now() - interval '2 days', now() - interval '2 days'),
  ('69fa0e3c-4826-466c-9e0a-996097ec9fda','11111111-0000-0000-0000-000000000008','pending', now() - interval '5 hours', now() - interval '5 hours'),
  -- Dummy-to-dummy accepted (for social density)
  ('11111111-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000002','accepted', now() - interval '20 days', now() - interval '19 days'),
  ('11111111-0000-0000-0000-000000000003','11111111-0000-0000-0000-000000000011','accepted', now() - interval '18 days', now() - interval '17 days'),
  ('11111111-0000-0000-0000-000000000005','11111111-0000-0000-0000-000000000013','accepted', now() - interval '15 days', now() - interval '14 days'),
  ('11111111-0000-0000-0000-000000000004','11111111-0000-0000-0000-000000000012','accepted', now() - interval '11 days', now() - interval '10 days'),
  ('11111111-0000-0000-0000-000000000009','11111111-0000-0000-0000-000000000016','accepted', now() - interval '9 days', now() - interval '8 days')
ON CONFLICT (requester_id, addressee_id) DO NOTHING;

-- ---------- 7. Conversations + messages ----------
-- conversations require user_a < user_b. Admin id starts with 69, dummies with 11, so dummy < admin → user_a = dummy.
-- Conversation 1: Ada ↔ admin
INSERT INTO public.conversations (id, user_a, user_b, last_message_at) VALUES
  ('aaaa0001-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000001','69fa0e3c-4826-466c-9e0a-996097ec9fda', now() - interval '20 minutes'),
  ('aaaa0001-0000-0000-0000-000000000002','11111111-0000-0000-0000-000000000002','69fa0e3c-4826-466c-9e0a-996097ec9fda', now() - interval '2 hours'),
  ('aaaa0001-0000-0000-0000-000000000003','11111111-0000-0000-0000-000000000005','69fa0e3c-4826-466c-9e0a-996097ec9fda', now() - interval '1 day'),
  ('aaaa0001-0000-0000-0000-000000000004','11111111-0000-0000-0000-000000000010','69fa0e3c-4826-466c-9e0a-996097ec9fda', now() - interval '6 hours')
ON CONFLICT (user_a, user_b) DO NOTHING;

INSERT INTO public.messages (conversation_id, sender_id, body, created_at) VALUES
  -- Ada ↔ admin
  ('aaaa0001-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000001','Yo Sim! Just saw Campulse — this is insane 🤯', now() - interval '3 hours'),
  ('aaaa0001-0000-0000-0000-000000000001','69fa0e3c-4826-466c-9e0a-996097ec9fda','Hahaha thanks Ada 🙏 still very rough, what would you add first?', now() - interval '2 hours 50 minutes'),
  ('aaaa0001-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000001','Honestly? Push notifications for marketplace replies. People miss DMs', now() - interval '2 hours 40 minutes'),
  ('aaaa0001-0000-0000-0000-000000000001','69fa0e3c-4826-466c-9e0a-996097ec9fda','Noted. Adding it next sprint 💪', now() - interval '25 minutes'),
  ('aaaa0001-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000001','You''re the GOAT 🐐', now() - interval '20 minutes'),

  -- Tunde ↔ admin
  ('aaaa0001-0000-0000-0000-000000000002','11111111-0000-0000-0000-000000000002','Bro, dropped the iPhone listing in marketplace. Boost it small for me 😅', now() - interval '4 hours'),
  ('aaaa0001-0000-0000-0000-000000000002','69fa0e3c-4826-466c-9e0a-996097ec9fda','Ha! Algorithm don''t play favourites yet 😂', now() - interval '3 hours 30 minutes'),
  ('aaaa0001-0000-0000-0000-000000000002','11111111-0000-0000-0000-000000000002','Ok ok, no shaking. Catch you at the meetup?', now() - interval '2 hours 10 minutes'),
  ('aaaa0001-0000-0000-0000-000000000002','69fa0e3c-4826-466c-9e0a-996097ec9fda','Yes! Bring two friends, free drinks ✌️', now() - interval '2 hours'),

  -- Bisi ↔ admin
  ('aaaa0001-0000-0000-0000-000000000003','11111111-0000-0000-0000-000000000005','Sim, OAU SUG wants to partner on the next election coverage. Can we hop on a call?', now() - interval '1 day 6 hours'),
  ('aaaa0001-0000-0000-0000-000000000003','69fa0e3c-4826-466c-9e0a-996097ec9fda','Absolutely. Send me a few slots that work this week 🙌', now() - interval '1 day 5 hours'),
  ('aaaa0001-0000-0000-0000-000000000003','11111111-0000-0000-0000-000000000005','Wed 4pm or Thu 6pm. Will share the brief tonight.', now() - interval '1 day 4 hours'),
  ('aaaa0001-0000-0000-0000-000000000003','69fa0e3c-4826-466c-9e0a-996097ec9fda','Locking Thu 6pm. Talk soon!', now() - interval '1 day'),

  -- Sarah ↔ admin
  ('aaaa0001-0000-0000-0000-000000000004','11111111-0000-0000-0000-000000000010','Campus Journal would love to write the Campulse story. Can we get a quote?', now() - interval '12 hours'),
  ('aaaa0001-0000-0000-0000-000000000004','69fa0e3c-4826-466c-9e0a-996097ec9fda','Of course, fire away. What angle are you going with?', now() - interval '10 hours'),
  ('aaaa0001-0000-0000-0000-000000000004','11111111-0000-0000-0000-000000000010','"How a founder is rebuilding student social life from UNILAG outwards" 📰', now() - interval '7 hours'),
  ('aaaa0001-0000-0000-0000-000000000004','69fa0e3c-4826-466c-9e0a-996097ec9fda','I love that. Sending you a long-form answer by EOD.', now() - interval '6 hours');

-- ---------- 8. One open report (for moderation queue) ----------
INSERT INTO public.reports (reporter_id, target_kind, target_id, reason, status, created_at)
SELECT
  '11111111-0000-0000-0000-000000000003',
  'post',
  p.id,
  'Spam',
  'open',
  now() - interval '20 minutes'
FROM public.posts p
WHERE p.body LIKE 'DM ME FOR EASY MONEY%'
LIMIT 1;

