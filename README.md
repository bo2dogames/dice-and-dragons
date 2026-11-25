# Dice & Dragons

Веб-приложение для кампаний D&D. Фронтенд собирается в GitHub Actions и публикуется через GitHub Pages; регистрация, вход и личные данные работают через Supabase Auth и PostgreSQL.

## Локальный запуск

1. Создайте проект Supabase и примените SQL из `supabase/migrations/202611250001_create_account_data.sql` в SQL Editor.
2. Скопируйте `.env.example` в `.env.local`.
3. Вставьте Project URL и Publishable key из Supabase Connect dialog.
4. В настройках Supabase Auth URL Configuration укажите локальный адрес `http://localhost:5173` как Site URL и Redirect URL.
5. Выполните:

```sh
npm ci
npm run dev
```

## Публикация на GitHub Pages

1. Создайте репозиторий `dice-and-dragons` в GitHub и отправьте туда файлы проекта. Не загружайте `.env.local`, пароли или секретные ключи.
2. В GitHub откройте **Settings → Secrets and variables → Actions** и добавьте secrets `VITE_SUPABASE_URL` и `VITE_SUPABASE_PUBLISHABLE_KEY`. Publishable key рассчитан на клиентское приложение; безопасность данных обеспечивает RLS.
3. В **Settings → Pages** выберите **GitHub Actions** как источник публикации.
4. Отправьте изменения в ветку `main`. Workflow из `.github/workflows/deploy.yml` соберёт сайт и опубликует его.
5. После первой публикации добавьте выданный GitHub Pages адрес в Supabase **Authentication → URL Configuration → Redirect URLs**. Для проекта `owner/dice-and-dragons` адрес обычно `https://owner.github.io/dice-and-dragons/`.

GitHub Pages для бесплатного аккаунта требует публичный репозиторий; опубликованный сайт доступен всем в интернете. Если репозиторий должен остаться закрытым, нужен план GitHub, поддерживающий Pages для private repos, либо другой статический хостинг.

## Аккаунты и приватность данных

Пользователь регистрируется как игрок или мастер. Supabase хранит учётные записи и JSON-данные приложения. Таблица `account_data` защищена Row Level Security: каждый аккаунт читает и меняет только собственные строки. Не добавляйте `service_role` key или пароль базы данных во фронтенд или GitHub Actions.

При первом входе старые локальные данные переносятся в аккаунт; демо-герои, NPC, кампания и сессия отфильтровываются. Листы, заметки, карты и прочие сохранённые данные аккаунта загружаются с Supabase на любом устройстве с этим аккаунтом. Изменения с других устройств появляются в открытом приложении в течение нескольких секунд. Совместная сессия между разными аккаунтами (мастер и игроки) пока не реализована.

