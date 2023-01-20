const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwtToken = require("jsonwebtoken");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;

const intializeDbAndServer = async () => {
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });
  app.listen(3000, () => {
    console.log("Server Running at http://localhost:3000");
  });
};

intializeDbAndServer();

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRETE_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.jwtToken = jwtToken;
        next();
      }
    });
  }
};

app.post("/login/", authenticateToken, async (request, response) => {
  const { username, password } = request.body;
  const getQuery = `SELECT
                    *
                FROM
                    user
                WHERE
                    username = ${username};`;
  const dbUser = await db.get(getQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid User");
  } else {
    const isPasswordMatched = bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const { jwtToken } = request.jwtToken;
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

app.get("/states/", async (request, response) => {
  const getQuery = `SELECT
                    state_id AS stateId,
                    state_name AS stateName,
                    population AS population
                FROM
                    state
                ORDER BY
                    state_id;`;
  const dbResponse = await db.all(getQuery);
  response.send(dbResponse);
});

app.get("/states/:stateId", async (request, response) => {
  const { stateId } = request.params;
  const getQuery = `SELECT
                    state_id AS stateId,
                    state_name AS stateName,
                    population AS population
                FROM
                    state
                WHERE 
                    state_id = ${stateId};`;
  const dbResponse = await db.get(getQuery);
  response.send(dbResponse);
});

app.post("/districts/", async (request, response) => {
  try {
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const addQuery = `INSERT INTO
                        district (district_name,state_id,cases,cured,active,deaths)
                    VALUES
                    (
                        '${districtName}',
                        ${stateId},
                        ${cases},
                        ${cured},
                        ${active},
                        ${deaths}
                    );`;
    await db.run(addQuery);
    response.send("District Successfully Added");
  } catch (e) {
    console.log(e.message);
  }
});

app.get("/districts/:districtId", async (request, response) => {
  const { districtId } = request.params;
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const getQuery = `SELECT
                    district_id AS districtId,
                    district_name AS districtName,
                    state_id AS stateId,
                    cases,
                    cured,
                    active,
                    deaths
                FROM
                    district
                WHERE 
                    district_id = ${districtId};`;
  const dbResponse = await db.get(getQuery);
  response.send(dbResponse);
});

app.delete("/districts/:districtId", async (request, response) => {
  const { districtId } = request.params;
  const removeQuery = `DELETE FROM
                    district
                WHERE 
                    district_id = ${districtId};`;
  const dbResponse = await db.run(removeQuery);
  response.send("District Removed");
});

app.put("/districts/:districtId", async (request, response) => {
  const { districtId } = request.params;
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const updateQuery = `UPDATE
                        district
                    SET
                       district_name = '${districtName}',
                       state_id = ${stateId},
                       cases = ${cases},
                       cured = ${cured},
                       active = ${active},
                       deaths = ${deaths}
                    WHERE
                        district_id = ${districtId};`;
  await db.run(updateQuery);
  response.send("District Details Updated");
});

app.get("/states/:stateId/stats", async (request, response) => {
  const { stateId } = request.params;
  const getQuery = `SELECT
                    SUM(cases) AS totalCases,
                    SUM(cured) AS totalCured,
                    SUM(active) AS totalActive,
                    SUM(deaths) AS totalDeaths
                FROM
                    district
                WHERE
                    state_id = ${stateId};`;
  const dbResponse = await db.get(getQuery);
  response.send(dbResponse);
});

module.exports = app;
