require('dotenv').config();
const QRCode = require('qrcode');
const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const cors = require('cors');

//LOGS
const morgan = require("morgan");
const fs = require("fs");
const path = require("path");

const LOG_DIR = process.env.LOG_DIR || "./data/logs";

fs.mkdirSync(LOG_DIR, { recursive: true });

const logStream = fs.createWriteStream(
  path.join(LOG_DIR, "access.log"),
  { flags: "a" }
);

function formatLithuanianTimestamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Vilnius",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
    hourCycle: "h23",
    timeZoneName: "longOffset"
  })
    .formatToParts(date)
    .reduce((values, part) => {
      if (part.type !== "literal") {
        values[part.type] = part.value;
      }
      return values;
    }, {});

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}.${parts.fractionalSecond}${parts.timeZoneName.replace("GMT", "")}`;
}



const app = express();
app.use(cors());
app.use(bodyParser.json());


//-------------------
//LOGS
//-------------------

// Determine whether the request came from the UI or an API client.
morgan.token("request-source", (req) => {
  const referer = req.get("referer") || "";

  if (referer.includes("localhost") || referer.includes("http://localhost")) {
    return "UI";
  }

  return "API";
});

// Log all required request details.
app.use(morgan((tokens, req, res) => {
  const logEntry = {
    timestamp: formatLithuanianTimestamp(),
    ip: tokens["remote-addr"](req, res),
    method: tokens.method(req, res),
    path: tokens.url(req, res),
    status: Number(tokens.status(req, res)),
    userAgent: tokens["user-agent"](req, res),
    source: tokens["request-source"](req, res),
    durationMs: Number(tokens["response-time"](req, res))
  };

  return JSON.stringify(logEntry);
  }, {
  stream: logStream
}));

//-------------------
//-----------------------------------------------------------------------------------
//-------------------


const db = mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_DATABASE || "qr_codes"
});

db.connect(function(err) {
  if (err) throw err;
  console.log("Connected!");
});

app.get('/', (req,res) =>{
    res.send("Hello from node API YAY");
});


const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Contact QR Code API",
      version: "1.0.0",
      description: "API for saving contacts and generating QR codes."
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Local development server"
      }
    ]
  },
  apis: ["./app.js"]
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
//------------------------------------------------------------------------------

/**
 * @openapi
 * /api/qr:
 *   get:
 *     summary: Get all contacts
 *     description: Retrieves all contacts stored in the database.
 *     tags:
 *       - QR Codes
 *     responses:
 *       "200":
 *         description: List of contacts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                     example: 1
 *                   fname:
 *                     type: string
 *                     example: Jane
 *                   lname:
 *                     type: string
 *                     nullable: true
 *                     example: Smith
 *                   tel:
 *                     type: string
 *                     example: "+37060012345"
 *                   email:
 *                     type: string
 *                     nullable: true
 *                     example: jane@example.com
 *                   street:
 *                     type: string
 *                     nullable: true
 *                     example: Main Street 10
 *                   city:
 *                     type: string
 *                     nullable: true
 *                     example: Kaunas
 *                   country:
 *                     type: string
 *                     nullable: true
 *                     example: Lithuania
 *                   date:
 *                     type: string
 *                     format: date
 *                     nullable: true
 *                     example: "1995-04-20"
 *       "500":
 *         description: Database query failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Database query failed
 */

// GET: Fetch all data
app.get('/api/qr', (req, res) => {
    db.query(
      `SELECT id, fname, lname, tel, email, street, city, country, date
      FROM qr_codes`,
    (err, results) => {
      if (err) {
        return res.status(500).json({
          error: "Database query failed"
        });
      }

      res.json(results);
    }
  );
});


function generate_vCard(
  firstName,
  lastName,
  phone,
  email,
  street,
  city,
  country,
  bday
) {
  const vcard = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${lastName || ""};${firstName || ""};;;`,
    `FN:${firstName || ""} ${lastName || ""}`,
    `TEL;TYPE=CELL:${phone || ""}`,
    ...(email ? [`EMAIL:${email}`] : []),
    `ADR;TYPE=HOME:;;${street || ""};${city || ""};;;${country || ""}`,
    ...(bday ? [`BDAY:${bday}`] : []),
    "END:VCARD"
  ].join("\r\n");

  return vcard;
}


/**
 * @openapi
 * /api/qr/{id}:
 *   get:
 *     summary: Get a contact and its saved QR code
 *     description: Retrieves a contact's details and previously stored QR image from the database using its ID.
 *     tags:
 *       - QR Codes
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the saved contact
 *         example: 12
 *     responses:
 *       "200":
 *         description: Contact details and saved QR code retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                   description: Unique contact ID
 *                   example: 12
 *                 fname:
 *                   type: string
 *                   description: Contact's first name
 *                   example: Jane
 *                 lname:
 *                   type: string
 *                   nullable: true
 *                   description: Contact's last name
 *                   example: Smith
 *                 tel:
 *                   type: string
 *                   description: Contact's telephone number
 *                   example: "+37060012345"
 *                 email:
 *                   type: string
 *                   nullable: true
 *                   description: Contact's email address
 *                   example: jane@example.com
 *                 street:
 *                   type: string
 *                   nullable: true
 *                   description: Contact's street address
 *                   example: Main Street 10
 *                 city:
 *                   type: string
 *                   nullable: true
 *                   description: Contact's city
 *                   example: Kaunas
 *                 country:
 *                   type: string
 *                   nullable: true
 *                   description: Contact's country
 *                   example: Lithuania
 *                 date:
 *                   type: string
 *                   format: date
 *                   nullable: true
 *                   description: Contact's birthday
 *                   example: "1995-04-20"
 *                 qrCode:
 *                   type: string
 *                   description: Saved PNG QR image encoded as a Base64 data URL
 *                   example: "data:image/png;base64,iVBORw0KGgo..."
 *       "404":
 *         description: Contact not found or saved QR image is missing
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   examples:
 *                     contactNotFound:
 *                       value: Contact not found
 *                     qrImageNotFound:
 *                       value: QR image not found for this contact
 *       "500":
 *         description: Database query failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Database query failed
 */

app.get('/api/qr/:id', (req, res) => {
  const { id } = req.params;

  db.query(
    `SELECT id, fname, lname, tel, email, street, city, country, date, qrcode
     FROM qr_codes
     WHERE id = ?`,
    [id],
    (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).json({
          error: 'Database query failed'
        });
      }

      if (results.length === 0) {
        return res.status(404).json({
          error: 'Contact not found'
        });
      }

      const contact = results[0];

      if (!contact.qrcode) {
        return res.status(404).json({
          error: 'QR image not found for this contact'
        });
      }

      const qrCode =
        'data:image/png;base64,' +
        Buffer.from(contact.qrcode).toString('base64');

      res.json({
        id: contact.id,
        fname: contact.fname,
        lname: contact.lname,
        tel: contact.tel,
        email: contact.email,
        street: contact.street,
        city: contact.city,
        country: contact.country,
        date: contact.date,
        qrCode: qrCode
      });
    }
  );
});



/**
 * @openapi
 * /api/qr:
 *   post:
 *     summary: Create a contact and save its QR code
 *     description: Creates a contact and stores its generated PNG QR image in MySQL. If an identical contact already exists, returns its existing ID.
 *     tags:
 *       - QR Codes
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fname
 *               - tel
 *             properties:
 *               fname:
 *                 type: string
 *                 example: Jane
 *               lname:
 *                 type: string
 *                 nullable: true
 *                 example: Smith
 *               tel:
 *                 type: string
 *                 example: "+37060012345"
 *               email:
 *                 type: string
 *                 nullable: true
 *                 example: jane@example.com
 *               street:
 *                 type: string
 *                 nullable: true
 *                 example: Main Street 10
 *               city:
 *                 type: string
 *                 nullable: true
 *                 example: Kaunas
 *               country:
 *                 type: string
 *                 nullable: true
 *                 example: Lithuania
 *               date:
 *                 type: string
 *                 format: date
 *                 nullable: true
 *                 example: "1995-04-20"
 *     responses:
 *       "201":
 *         description: Contact and QR image created and saved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 id:
 *                   type: integer
 *                   example: 12
 *                 duplicate:
 *                   type: boolean
 *                   example: false
 *                 qrCode:
 *                   type: string
 *                   description: Generated PNG as a Base64 data URL
 *                   example: "data:image/png;base64,iVBORw0KGgo..."
 *       "200":
 *         description: Duplicate contact found; existing ID and saved QR image returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 id:
 *                   type: integer
 *                   example: 12
 *                 duplicate:
 *                   type: boolean
 *                   example: true
 *                 qrCode:
 *                   type: string
 *                   description: Existing PNG as a Base64 data URL
 *       "400":
 *         description: Required fields are missing
 *       "500":
 *         description: Database operation or QR generation failed
 */
app.post("/api/qr", async (req, res) => {
  const {
    fname,
    lname,
    tel,
    email,
    street,
    city,
    country,
    date
  } = req.body;

  if (!fname || !fname.trim() || !tel || !tel.trim()) {
    return res.status(400).json({
      error: "First name and phone number are required."
    });
  }

  const values = [
    fname.trim(),
    lname || null,
    tel.trim(),
    email || null,
    street || null,
    city || null,
    country || null,
    date || null
  ];

  const makeQrBuffer = async () => {
    const vcard = generate_vCard(
      values[0],
      values[1],
      values[2],
      values[3],
      values[4],
      values[5],
      values[6],
      values[7]
    );

    return QRCode.toBuffer(vcard, {
      type: "png",
      width: 300,
      margin: 2
    });
  };

  const findQuery = `
    SELECT id, qrcode
    FROM qr_codes
    WHERE fname = ?
      AND lname <=> ?
      AND tel = ?
      AND email <=> ?
      AND street <=> ?
      AND city <=> ?
      AND country <=> ?
      AND date <=> ?
    LIMIT 1
  `;

  db.query(findQuery, values, async (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({
        error: "Failed to check for duplicate contacts."
      });
    }

    try {
      // Reuse an existing contact if a duplicate is found.
      if (results.length > 0) {
        const existing = results[0];
        let imageBuffer = existing.qrcode;

        // // Older contacts may not have a saved QR image yet.
        // if (!imageBuffer) {
        //   imageBuffer = await makeQrBuffer();

        //   await db.promise().query(
        //     "UPDATE qr_codes SET qrcode = ? WHERE id = ?",
        //     [imageBuffer, existing.id]
        //   );
        // }

        return res.status(200).json({
          success: true,
          id: existing.id,
          duplicate: true,
          qrCode:
            "data:image/png;base64," +
            Buffer.from(imageBuffer).toString("base64")
        });
      }

      // Create the contact first.
      const insertQuery = `
        INSERT INTO qr_codes
          (fname, lname, tel, email, street, city, country, date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

      db.query(insertQuery, values, async (insertErr, result) => {
        if (insertErr) {
          console.error(insertErr);
          return res.status(500).json({
            error: "Failed to insert contact."
          });
        }

        const id = result.insertId;

        try {
          // Generate the PNG and save its binary bytes in MySQL.
          const imageBuffer = await makeQrBuffer();

          await db.promise().query(
            "UPDATE qr_codes SET qrcode = ? WHERE id = ?",
            [imageBuffer, id]
          );

          return res.status(201).json({
            success: true,
            id,
            duplicate: false,
            qrCode:
              "data:image/png;base64," +
              imageBuffer.toString("base64")
          });
          //errors 1
        } catch (qrErr) {
          console.error(qrErr);
          return res.status(500).json({
            error: "Contact created, but saving its QR image failed.",
            id
          });
        }
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        error: "Failed to generate or save QR image."
      });
    }
  });
});


app.get("/api/logs", (req, res) => {
  fs.readFile(
    path.join(LOG_DIR, "access.log"),
    "utf8",
    (err, content) => {
      if (err) {
        console.error(err);
        return res.status(500).json({
          error: "Failed to read request logs"
        });
      }

      const logs = content
        .split("\n")
        .filter(line => line.trim() !== "")
        .map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(log => log !== null);

      res.json(logs);
    }
  );
});


if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = { app, generate_vCard, formatLithuanianTimestamp };