
const request = require("supertest");

// app.js creates its database connection when it is imported.
jest.mock("mysql2", () => {
  const db = {
    connect: jest.fn((callback) => {
      if (callback) callback(null);
    }),
    query: jest.fn(),
    promise: jest.fn()
  };

  return {
    createConnection: jest.fn(() => db),
    __db: db
  };
});

const mysql = require("mysql2");
const db = mysql.__db;
const { app, generate_vCard, formatLithuanianTimestamp } = require("./app");

describe("formatLithuanianTimestamp", () => {
  test("formats summer timestamps with Lithuania's daylight-saving offset", () => {
    expect(formatLithuanianTimestamp(new Date("2026-07-15T12:34:56.789Z")))
      .toBe("2026-07-15T15:34:56.789+03:00");
  });

  test("formats winter timestamps with Lithuania's standard-time offset", () => {
    expect(formatLithuanianTimestamp(new Date("2026-01-15T12:34:56.789Z")))
      .toBe("2026-01-15T14:34:56.789+02:00");
  });
});

const sampleContact = {
  id: 1,
  fname: "Jane",
  lname: "Doe",
  tel: "+37060000000",
  email: "jane@example.com",
  street: "Main Street 10",
  city: "Kaunas",
  country: "Lithuania",
  date: "1995-04-20"
};

const sampleQrBuffer = Buffer.from("fake-png-image");

function mockQuery(callback) {
  db.query.mockImplementation((sql, paramsOrCallback, maybeCallback) => {
    const done =
      typeof paramsOrCallback === "function"
        ? paramsOrCallback
        : maybeCallback;

    callback(sql, done);
  });
}

beforeEach(() => {
  jest.clearAllMocks();

  // Mock the promise-based query used to save QR image bytes.
  db.promise.mockReturnValue({
    query: jest.fn().mockResolvedValue([{ affectedRows: 1 }, []])
  });

  // Default responses for the endpoints.
  mockQuery((sql, done) => {
    if (sql.includes("WHERE id = ?")) {
      return done(null, [
        { ...sampleContact, qrcode: sampleQrBuffer }
      ]);
    }

    if (sql.includes("SELECT id, qrcode")) {
      // No duplicate found by default.
      return done(null, []);
    }

    if (sql.includes("INSERT INTO qr_codes")) {
      return done(null, { insertId: 42 });
    }

    if (sql.includes("FROM qr_codes")) {
      return done(null, [sampleContact]);
    }

    return done(null, []);
  });
});

describe("generate_vCard", () => {
  test("builds a vCard containing the contact fields", () => {
    const card = generate_vCard(
      "Jane",
      "Doe",
      "+37060000000",
      "jane@example.com",
      "Main Street 10",
      "Kaunas",
      "Lithuania",
      "1995-04-20"
    );

    expect(card).toContain("BEGIN:VCARD");
    expect(card).toContain("VERSION:3.0");
    expect(card).toContain("N:Doe;Jane;;;");
    expect(card).toContain("FN:Jane Doe");
    expect(card).toContain("TEL;TYPE=CELL:+37060000000");
    expect(card).toContain("EMAIL:jane@example.com");
    expect(card).toContain("ADR;TYPE=HOME:");
    expect(card).toContain("BDAY:1995-04-20");
    expect(card).toContain("END:VCARD");
  });

  test("omits email and birthday when they are not provided", () => {
    const card = generate_vCard(
      "Jane",
      "Doe",
      "+37060000000",
      "",
      "",
      "",
      "",
      ""
    );

    expect(card).not.toContain("EMAIL:");
    expect(card).not.toContain("BDAY:");
    expect(card).toContain("END:VCARD");
  });
});

describe("GET /", () => {
  test("returns the API hello message", async () => {
    const res = await request(app).get("/");

    expect(res.statusCode).toBe(200);
    expect(res.text).toContain("Hello from node API");
  });
});

describe("GET /health", () => {
  test("returns healthy when the database responds", async () => {
    const res = await request(app).get("/health");

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      status: "healthy",
      database: "connected"
    });
    expect(db.query).toHaveBeenCalledWith("SELECT 1", expect.any(Function));
  });

  test("returns 503 when the database query fails", async () => {
    mockQuery((sql, done) => {
      done(new Error("Database unavailable"));
    });

    const res = await request(app).get("/health");

    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({
      status: "unhealthy",
      database: "unavailable"
    });
  });
});

describe("GET /api/qr", () => {
  test("returns the contact rows", async () => {
    const res = await request(app).get("/api/qr");

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toMatchObject({
      id: 1,
      fname: "Jane",
      lname: "Doe",
      tel: "+37060000000"
    });
  });

  test("returns 500 when the database query fails", async () => {
    mockQuery((sql, done) => {
      done(new Error("Database unavailable"));
    });

    const res = await request(app).get("/api/qr");

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({
      error: "Database query failed"
    });
  });
});

describe("GET /api/qr/:id", () => {
  test("returns contact details and a Base64 QR image", async () => {
    const res = await request(app).get("/api/qr/1");

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      id: 1,
      fname: "Jane",
      lname: "Doe",
      email: "jane@example.com"
    });

    expect(res.body.qrCode).toMatch(
      /^data:image\/png;base64,/
    );
  });

  test("returns 404 when the contact does not exist", async () => {
    mockQuery((sql, done) => {
      if (sql.includes("WHERE id = ?")) {
        return done(null, []);
      }

      done(null, []);
    });

    const res = await request(app).get("/api/qr/999999");

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe("Contact not found");
  });

  test("returns 404 when the contact has no saved QR image", async () => {
    mockQuery((sql, done) => {
      if (sql.includes("WHERE id = ?")) {
        return done(null, [
          { ...sampleContact, qrcode: null }
        ]);
      }

      done(null, []);
    });

    const res = await request(app).get("/api/qr/1");

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe(
      "QR image not found for this contact"
    );
  });

  test("returns 500 when the database query fails", async () => {
    mockQuery((sql, done) => {
      done(new Error("Database unavailable"));
    });

    const res = await request(app).get("/api/qr/1");

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe("Database query failed");
  });
});

describe("POST /api/qr", () => {
  const newContact = {
    fname: "Jane",
    lname: "Doe",
    tel: "+37060000000",
    email: "jane@example.com",
    street: "Main Street 10",
    city: "Kaunas",
    country: "Lithuania",
    date: "1995-04-20"
  };

  test("rejects a request without a first name", async () => {
    const res = await request(app)
      .post("/api/qr")
      .send({
        ...newContact,
        fname: " "
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe(
      "First name and phone number are required."
    );
  });

  test("rejects a request without a phone number", async () => {
    const res = await request(app)
      .post("/api/qr")
      .send({
        ...newContact,
        tel: ""
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe(
      "First name and phone number are required."
    );
  });

  test("creates a contact and returns a QR image", async () => {
    const res = await request(app)
      .post("/api/qr")
      .send(newContact);

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.id).toBe(42);
    expect(res.body.duplicate).toBe(false);
    expect(res.body.qrCode).toMatch(
      /^data:image\/png;base64,/
    );
  });

  test("returns the existing contact when a duplicate is found", async () => {
    mockQuery((sql, done) => {
      if (sql.includes("SELECT id, qrcode")) {
        return done(null, [
          { id: 7, qrcode: sampleQrBuffer }
        ]);
      }

      done(null, []);
    });

    const res = await request(app)
      .post("/api/qr")
      .send(newContact);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.id).toBe(7);
    expect(res.body.duplicate).toBe(true);
    expect(res.body.qrCode).toMatch(
      /^data:image\/png;base64,/
    );
  });

  test("returns 500 when checking for duplicates fails", async () => {
    mockQuery((sql, done) => {
      if (sql.includes("SELECT id, qrcode")) {
        return done(new Error("Database unavailable"));
      }

      done(null, []);
    });

    const res = await request(app)
      .post("/api/qr")
      .send(newContact);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe(
      "Failed to check for duplicate contacts."
    );
  });

  test("returns 500 when inserting a new contact fails", async () => {
    mockQuery((sql, done) => {
      if (sql.includes("SELECT id, qrcode")) {
        return done(null, []);
      }

      if (sql.includes("INSERT INTO qr_codes")) {
        return done(new Error("Insert failed"));
      }

      done(null, []);
    });

    const res = await request(app)
      .post("/api/qr")
      .send(newContact);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe("Failed to insert contact.");
  });
});
