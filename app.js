const express = require("express");
const path = require("path");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const app = express();
app.use(express.json());

let db = null;
const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000");
    });
  } catch (e) {
    console.error(`DB Error: ${e.message}`);
  }
};

initializeDbAndServer();

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
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

const convertArraySnakeToPascal = (array) => {
  return array.map((obj) => {
    const pascalObject = {};

    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const snakeParts = key.split("_");
        const pascalKey = snakeParts
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join("");
        pascalObject[pascalKey] = obj[key];
      }
    }

    return pascalObject;
  });
};

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  console.log(username, password);
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid User");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400).send("Invalid Password");
    }
  }
});

app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesQuery = `
            SELECT
              *
            FROM
             state
            ORDER BY
              state_id;`;
  const statesArray = await db.all(getStatesQuery);
  const modifiedStatesArray = convertArraySnakeToPascal(statesArray);
  response.send(modifiedStatesArray);
});

app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `
        SELECT 
            *
        FROM
            state
        WHERE
            state_id = ${stateId}
  `;

  const stateData = await db.get(getStateQuery);
  const [modifyStateData] = convertArraySnakeToPascal([stateData]);
  response.send(modifyStateData);
});

app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;

  const createDistrictQuery = `
        INSERT INTO
             district(district_name, state_id, cases, cured, active, deaths)
        VALUES
            (?,?,?,?,?,?);
    `;

  try {
    const dbResponse = await db.run(createDistrictQuery, [
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    ]);
    response.send("District Successfully Added");
  } catch (e) {
    console.log(e.message);
  }
});

app.get(
  "/districts/:districtId",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;

    const getDistrictQuery = `
    
        SELECT 
            *
        FROM
            district
        WHERE
            district_id = ? ;
    `;
    const districtData = await db.get(getDistrictQuery, [districtId]);
    const [modifiedDistrictData] = convertArraySnakeToPascal([districtData]);
    response.send(modifiedDistrictData);
  }
);

app.delete(
  "/districts/:districtId",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `
        DELETE FROM district WHERE district_id = ?;
    `;
    await db.run(deleteDistrictQuery, [districtId]);
    response.send("District Removed");
  }
);

app.put(
  "/districts/:districtId",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;

    const updateDetailsQuery = `
        UPDATE
            district
        SET 
            district_name = ?,
            state_id = ?, 
            cases = ?,
            cured = ?,
            active = ?,
            deaths = ?
        WHERE
            district_id = ?
    `;

    await db.run(updateDetailsQuery, [
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
      districtId,
    ]);

    response.send("District Details Updated");
  }
);
