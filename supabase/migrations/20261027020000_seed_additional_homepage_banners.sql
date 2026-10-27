insert into public.homepage_banners (
  title,
  image_path,
  alt_text,
  target_url,
  display_order,
  is_active
)
values
  (
    'Join DawaSetu — Grow Your Pharmacy Business',
    '/banners/dawasetu-pharmacy-growth.jpeg',
    'Pharmacy owners can join DawaSetu to list their pharmacy, share medicine availability, and reach nearby customers.',
    '/partner/register',
    1,
    true
  ),
  (
    'Lokpali Medicos — Your Trusted Local Pharmacy',
    '/banners/lokpali-medicos.jpeg',
    'Lokpali Medicos, a local pharmacy in Haflong, Dima Hasao, Assam, with pharmacy and wellness products.',
    '/pharmacies',
    2,
    true
  )
on conflict (image_path) do nothing;
