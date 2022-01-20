import express from "express";
import fs from "fs";
import bodyParser from "body-parser";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./docs";

const app = express();
const PORT = 3000;
const FILE_PATH = "dota-prefs.json";

type Users = {
  [key: string]: string[];
};

type UserRole = {
  user: string;
  role: number;
};

let preferenceCache: Users = null;
generateFileOrUpdateCache();

app.use(bodyParser.json());
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/**
 * @swagger
 * /:
 *   get:
 *     summary: All users & roles
 *     description: Retrieve a list of all users and their roles.
 *     responses:
 *       200:
 *         description: All users.
 */
app.get("/", (req, res) => {
  res.json(preferenceCache);
});

/**
 * @swagger
 * /healthcheck:
 *   get:
 *     summary: Server healthcheck
 *     description: Quickly verify that the server is alive without invocing any logic.
 *     responses:
 *       200:
 *         description: Living message
 */
app.get("/healthcheck", (req, res) => {
  res.status(200).send("Totally alive " + Math.random() * 100);
});

/**
 * @swagger
 * /role/{user}:
 *   get:
 *     summary: Get user & roles
 *     description: Retrieve a specific user and their roles.
 *     parameters:
 *       - in: path
 *         name: user
 *         required: true
 *         description: Name of user
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: A user's roles.
 */
app.get("/role/:user", (req, res) => {
  const roles = preferenceCache[req.params.user?.toLowerCase()];
  res.status(roles ? 200 : 404).json(roles);
});

/**
 * @swagger
 * /roles:
 *   post:
 *     summary: Generate preferred roles in random order
 *     description: API main functionality, receives users and shuffles them and then gives each player their most preferred & available role.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               json:
 *                 type: boolean
 *                 description: If you don't want a stringified version
 *                 example: true
 *               users:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: All users of the party.
 *                 example: ['Loda', 's4', 'AdmiralBulldog', 'EGM', 'Akke']
 *     responses:
 *       200:
 *         description: A string or list of users, depending on the `json` body parameter.
 */
app.post("/roles", (req, res) => {
  const { users, json } = req.body;

  const randomUsers = shuffleArray(users);
  const num = randomUsers.length;
  const prefs = { ...preferenceCache };

  const calculatedRoles: UserRole[] = [];

  while (calculatedRoles.length < num) {
    const user = randomUsers.shift();
    if (user == undefined) break;

    const userPrefs = [...(prefs[user] || []), "5", "4", "3", "2", "1"];

    const pref = findBestAvailablePreference(calculatedRoles, userPrefs);
    if (pref == "fill") {
      delete prefs[user][prefs[user].indexOf("fill")];
      randomUsers.push(user);
      continue;
    }

    calculatedRoles.push({ user: user, role: parseInt(pref) });
  }

  if (json) {
    res.json(calculatedRoles);
  } else {
    res.send(calculatedRoles.map((x) => `${x.user} (${x.role})`).join(" > "));
  }
});

/**
 * @swagger
 * /onlyshuffle:
 *   post:
 *     summary: Get users in random order
 *     description: No preferred roles, just a shuffled into a string separated by >
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               users:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: All users of the party.
 *                 example: ['Loda', 's4', 'AdmiralBulldog', 'EGM', 'Akke']
 *     responses:
 *       200:
 *         description: A list of users.
 */
app.post("/onlyshuffle", (req, res) => {
  const { users } = req.body;
  const randomUsers = shuffleArray(users);
  res.send(randomUsers.join(" > "));
});

const ACCEPTED_ROLES = ["fill", "1", "2", "3", "4", "5"];
/**
 * @swagger
 * /role:
 *   post:
 *     summary: Create or overwrite roles for user
 *     description: Accepted roles are "fill", "1", "2", "3", "4", "5"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               user:
 *                 type: string
 *                 description: User
 *                 example: Nisha
 *               roles:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: This user's preferred roles
 *                 example: ['fill', '2', '1', '3', '4', '5']
 *     responses:
 *       200:
 *         description: A verification message
 *       400:
 *         description: Error message, incorrect role string
 */
app.post("/role", (req, res) => {
  const { user, roles } = req.body;

  const validation = roles.reduce((a: boolean, c: any) => {
    return a && ACCEPTED_ROLES.includes(c);
  }, true);

  if (!validation) {
    return res
      .status(400)
      .send(
        "Request contained role other than accepted: " +
          ACCEPTED_ROLES.join(", ")
      );
  }

  preferenceCache[user.toLowerCase()] = roles;
  updateFile();
  res.status(200).send("Role added");
});

/**
 * @swagger
 * /{user}:
 *   delete:
 *     summary: Delete entry
 *     description: Delete by user's name
 *     parameters:
 *       - in: path
 *         name: user
 *         required: true
 *         description: Name of user
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success.
 *       404:
 *         description: User not found
 */
app.delete("/:user", (req, res) => {
  const foundUser =
    Object.keys(preferenceCache).indexOf(req.params.user?.toLowerCase()) !=
    undefined;

  if (foundUser) {
    delete preferenceCache[req.params.user?.toLowerCase()];
    updateFile();
  }

  res.sendStatus(foundUser ? 200 : 404);
});

function findBestAvailablePreference(
  calculatedRoles: UserRole[],
  userPrefs: string[]
) {
  for (const pref of userPrefs.filter((x) => x != undefined)) {
    const numberPref = parseInt(pref);
    if (calculatedRoles.find((x) => x.role == numberPref)) {
      continue;
    }

    return pref;
  }
}

function generateFileOrUpdateCache() {
  if (!fs.existsSync(FILE_PATH)) {
    fs.writeFileSync(FILE_PATH, "{}");
  }

  if (preferenceCache == null) {
    updateCache();
  }
}

function updateCache() {
  const raw = fs.readFileSync(FILE_PATH, "utf-8");
  const parsed = JSON.parse(raw);
  preferenceCache = parsed;
}

function updateFile() {
  fs.writeFileSync(FILE_PATH, JSON.stringify(preferenceCache));
}

function shuffleArray(arr: string[]) {
  const array = [...arr];
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

app.use((error: any, req: any, res: any, next: any) => {
  res.status(500).send(error.message);
});

app.listen(PORT, () => {
  console.log(`Server is running at ${PORT}`);
});
