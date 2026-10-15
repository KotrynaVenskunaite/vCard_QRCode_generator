# NOTES

## Design decisions

- Required fields are first name and phone number. Everything else is optional.
- The QR code contains a vCard 3.0. The built-in camera apps on iOS and Android recognise it . Empty optional fields are left out.
- QR images are generated on the server and stored in the database. Each image is generated once, saved as PNG bytes, and returned as a Base64 data URL. The history page shows the exact same image again without regenerating it.
- Submitting an identical contact returns the existing record (200, duplicate: true) instead of creating a copy.
- Every request is logged as one JSON line in access.log: timestamp (Lithuanian time), IP, method, path, status, user agent, source (UI or API) and duration. Logs can be viewed on the website or through GET /api/logs.
- The health check also checks the database. /health runs a simple query and returns 503 if MySQL is down. Docker uses it to mark the API as healthy, and the API only starts after MySQL is healthy.

## Technology choices

- Node.js and Express: well known and fast to build a REST API with. Same language as the frontend.
- MySQL: reliable storage for structured contact data
- qrcode library: suggested in a tutorial video.
- Swagger / OpenAPI: suggested in the case study.
- nginx for the frontend: suggested in a tutorial.
- Docker Compose: the whole stack starts with one command.
- Jest and Supertest: suggested in a tutorial video.
- GitHub Actions: suggested in a tutorial video.

## Trade-offs

- Images in the database cost is a larger database.
- Log file instead of a log table: filtering logs means reading the whole file.
- No login system: everyone can see everyone's created contacts.
- as it is a test case, ".env" is provided in the repository.

## Security considerations

- Secrets are only provided through .env and environment variables. .env is kept out of the Docker image by .dockerignore.
- All SQL queries use parameters (? placeholders), which prevents SQL injection.

## Improvements with more time

1. Server-side validation for email, phone, dates and lengths.
2. Optional Enhancements
3. Login system to not dox every usser to each other (contact wise).
