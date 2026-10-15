# vCard QR Code Generator

A small web application that turns contact details into a **vCard QR code**. Scanning the code with a phone offers to save the contact directly to the address book.

Contacts and their generated QR images are stored in MySQL, every request is written to a JSON access log, and the whole stack runs with a single `docker compose` command.

## Architecture overview

The application consists of four Docker containers defined in [`API/docker-compose.yml`](API/docker-compose.yml):

nginx/website (frontend) (8080)
api (3000)
mysql (3306)
phpmyadmin (8081)

---

## Technology stack

| Layer             | Technology                                                     |
| ----------------- | -------------------------------------------------------------- |
| Backend runtime   | Node.js 22 (`node:22-bookworm-slim` Docker image)              |
| Web framework     | Express                                                        |
| Database          | MySQL 8.4                                                      |
| Database driver   | `mysql2`                                                       |
| QR generation     | `qrcode` (PNG output)                                          |
| API documentation | OpenAPI 3.0 via `swagger-jsdoc` + `swagger-ui-express`         |
| Request logging   | `morgan` (custom JSON format, Europe/Vilnius timestamps)       |
| Config            | `dotenv`                                                       |
| Frontend          | Static HTML, CSS, vanilla JavaScript + jQuery, served by nginx |
| DB admin          | phpMyAdmin                                                     |
| Testing           | Jest + Supertest                                               |
| Containers        | Docker, Docker Compose                                         |
| CI/CD             | GitHub Actions                                                 |

---

## Project structure

```
vCard_QRCode_generator-main/
├── .github/workflows/ci_cd.yml   # GitHub Actions
├── README.md
└── API/
    ├── app.js                    # Express API (routes, logging, Swagger)
    ├── app.test.js               # Jest/Supertest tests
    ├── init.sql                  # Database (run on first MySQL start)
    ├── Dockerfile                # API container image
    ├── docker-compose.yml        # Full stack definition
    ├── .env                      # Local configuration (not baked into image)
    ├── .dockerignore
    ├── package.json
    ├── Logs/                     # access.log is written here (bind mount)
    └── website/                  # Static frontend served by nginx
        ├── index.html
        ├── javascript/qrcode.js
        ├── styles/qrcode.css
        └── img/
```

---

## Local setup

### Prerequisites

- Docker Desktop
- Node.js
- Git

### Build and start the stack

```bash
docker compose up --build
```

### run to delete the database volume (if there are issues with database)

```bash
docker compose down -v
```

### Open the app

http://localhost:8080

## Configuration

All configuration is done through environment variables in `API/.env`. Docker Compose reads this file automatically and refuses to start if a required value is missing.

## Accessing the application

Once `docker compose up` is running:

localhost:8080

## API usage

Base URL: http://localhost:3000

Interactive documentation is available at http://localhost:3000/api-docs

### Duplicate handling

If a `POST /api/qr` request matches an existing contact on **every** field, no new row is created. The API responds with `200`, `"duplicate": true`, and the existing contact's ID and QR image.

### QR image format

QR codes are returned as a Base64 PNG data URL (`data:image/png;base64,...`) that can be used directly as an `<img src>`. The encoded content is a vCard 3.0

### Request logs

Every request is appended to `access.log` as one JSON line

source is UI when the request's `Referer` contains `localhost`, otherwise `API`. Timestamps use Lithuanian time (Europe/Vilnius) with the correct summer/winter offset.

## Running tests

Tests live in API/app.test.js and use **Jest** with **Supertest**. The `mysql2` module is mocked, so **no database or Docker is needed** to run them.

```bash
cd API
npm ci        # install dependencies
npm test      # runs: jest --runInBand
```

What is covered:

- `formatLithuanianTimestamp` — correct +03:00 (summer) and +02:00 (winter) offsets
- `generate_vCard` — all fields included; optional email/birthday omitted when empty
- `GET /` and `GET /health` (healthy and unhealthy database)
- `GET /api/qr` and `GET /api/qr/:id` — success, not found, missing QR image, database errors
- `POST /api/qr` — validation (`400`), new contact (`201`), duplicate (`200`), duplicate-check failure and insert failure (`500`)

---

## CI/CD pipeline

The pipeline is defined in .github/workflows/ci_cd.yml and runs on GitHub Actions.

**Triggers**

- Every push to the `master` branch
- Every pull request

**Jobs**

test - runs on `ubuntu-latest` inside a `node:20` container
promote - runs only if `test` succeeded and the event was a push to `master`

---

## Deployment process

The application is deployed as a Docker Compose stack. `main` is the release branch

**To deploy or update a server:**

1. Install Docker and Docker Compose on the target machine.
2. Get the tested code from the `main` branch.
3. Build and start in the background:

```bash
cd API
docker compose up --build -d
```

---

## Persistent storage

Two kinds of data outlive container restarts:

### Database

- Contacts are stored in the `qr_codes` table. The QR PNG image is stored as binary data in the `qrcode` `LONGBLOB` column, so images never need to be regenerated.

### Logs

`access.log` is written to `API/Logs/` on the machine, so it can be opened directly and is kept even if containers or volumes are removed. It is listed in `.gitignore` and is not committed.

---
