# wahub

Title: WhatsApp Gateway Dashboard (Admin & Users)

Description / Full Prompt:

Build a clean, simple SaaS-style frontend with two separate dashboards: ADMIN and USER, each with its own login.

🔐 Authentication

Two roles: admin and user

Admin login page

User login page

Store users with: username, password, status(active/disabled), API key, messageCount, sessionStatus(online/offline/qr pending)

When a user logs in:

If user.status = disabled → show full-page warning:
“Your subscription is disabled. Contact admin.”
and hide all features.

🟦 ADMIN DASHBOARD (for me only)

Create a clean admin dashboard with the following pages:

Users Management Page

List all users in a table

username

status (active / disabled)

API key

session status

message count

Buttons:

Add User

Enable / Disable User

Reset Password

Reset WhatsApp Session (call backend endpoint)

Add User Form

Fields:

username

password

button [Create User]

After creation, auto-generate an API key (or backend will return it).

🟩 USER DASHBOARD

When a user logs in (if active):

Home Page

Show:

API Key

WhatsApp status:

“QR required”

“Connecting”

“Connected”

“Disconnected — Re-login required”

QR Connection Page

Show the QR code (retrieved from backend endpoint: /api/{apikey}/qr)

Auto-refresh every 3 seconds

Message Sender Page

Create UI forms to test sending:

Send Text Panel

Fields:

Number

Message
Button: [Send Text]

Send Image Panel

Fields:

Number

Image Upload

Caption
Button: [Send Image]

Send PDF Panel

Fields:

Number

PDF Upload

Caption
Button: [Send PDF]

Call backend routes:

/api/{apikey}/send-text

/api/{apikey}/send-image

/api/{apikey}/send-pdf

Show success or error alert.

🎨 STYLE REQUIREMENTS

White clean minimal dashboard

Sidebar navigation

Top bar with user info

Mobile responsive

Use simple, modern UI components

🔌 BACKEND CONNECTION

Do NOT build backend now.
Just create:

Service placeholders

Fake data for now

Pages that call placeholder endpoints

I will connect everything later.

End of Prompt

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://wahub.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/6b25fde9-fdd4-45ce-b46a-8110757c76e4).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
