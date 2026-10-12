insert into public.redirect_websites (
  name,
  website_url,
  description,
  button_text,
  display_position,
  open_in_new_tab,
  is_active
)
values (
  'Click2Book',
  'https://click2book.in',
  'Doctor Appointment & Booking Platform',
  'Book Doctor Appointment',
  0,
  true,
  true
)
on conflict (name) do nothing;
