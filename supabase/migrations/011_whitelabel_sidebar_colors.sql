alter table public.company_settings
  add column if not exists background_color text,
  add column if not exists sidebar_color text,
  add column if not exists sidebar_text_color text,
  add column if not exists sidebar_hover_color text;
