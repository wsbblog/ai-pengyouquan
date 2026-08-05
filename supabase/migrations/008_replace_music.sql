update public.posts
set music = jsonb_set(
  music,
  '{src}',
  to_jsonb(
    case music ->> 'src'
      when '/assets/music/rain-loop.wav' then '/assets/music/m1.mp3'
      when '/assets/music/sad-ambient.wav' then '/assets/music/m2.mp3'
      when '/assets/music/weekend-lofi.wav' then '/assets/music/m1.mp3'
      else music ->> 'src'
    end
  )
)
where music is not null
  and music ->> 'src' in (
    '/assets/music/rain-loop.wav',
    '/assets/music/sad-ambient.wav',
    '/assets/music/weekend-lofi.wav'
  );
